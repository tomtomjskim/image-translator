import type { EncryptedApiKey } from '../types';
import { STORAGE_KEYS } from '../utils/constants';

// Secure context 체크 (HTTPS 또는 localhost)
function isSecureContext(): boolean {
  return window.isSecureContext ||
         location.hostname === 'localhost' ||
         location.hostname === '127.0.0.1';
}

// 브라우저 핑거프린트 기반 암호화 키 생성 (Secure Context용)
async function getEncryptionKey(): Promise<CryptoKey> {
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
  ].join('|');

  const encoder = new TextEncoder();
  const data = encoder.encode(fingerprint);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// 간단한 XOR 기반 난독화 (HTTP 환경 Fallback용)
function getObfuscationKey(): string {
  return [
    navigator.userAgent.slice(0, 10),
    navigator.language,
    screen.width.toString(),
  ].join('_');
}

function xorEncode(str: string, key: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

// API 키 암호화 (AES-GCM, Secure Context)
async function encryptApiKeySecure(apiKey: string): Promise<EncryptedApiKey> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  const encrypted = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
  const ivString = btoa(String.fromCharCode(...iv));

  return { encrypted, iv: ivString };
}

// API 키 복호화 (AES-GCM, Secure Context)
async function decryptApiKeySecure(encryptedData: EncryptedApiKey): Promise<string> {
  const key = await getEncryptionKey();
  const encryptedBytes = Uint8Array.from(atob(encryptedData.encrypted), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedBytes
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// API 키 암호화 (XOR 난독화, HTTP Fallback)
function encryptApiKeyFallback(apiKey: string): EncryptedApiKey {
  const obfKey = getObfuscationKey();
  const encoded = xorEncode(apiKey, obfKey);
  const encrypted = btoa(encoded);
  // fallback 방식 표시를 위한 prefix
  return { encrypted, iv: 'fallback' };
}

// API 키 복호화 (XOR 난독화, HTTP Fallback)
function decryptApiKeyFallback(encryptedData: EncryptedApiKey): string {
  const obfKey = getObfuscationKey();
  const decoded = atob(encryptedData.encrypted);
  return xorEncode(decoded, obfKey);
}

// API 키 암호화 (환경에 따라 자동 선택)
export async function encryptApiKey(apiKey: string): Promise<EncryptedApiKey> {
  if (isSecureContext() && crypto.subtle) {
    try {
      return await encryptApiKeySecure(apiKey);
    } catch (error) {
      console.warn('Secure encryption failed, using fallback:', error);
      return encryptApiKeyFallback(apiKey);
    }
  }
  return encryptApiKeyFallback(apiKey);
}

// API 키 복호화 (환경에 따라 자동 선택)
export async function decryptApiKey(encryptedData: EncryptedApiKey): Promise<string> {
  // fallback 방식으로 저장된 경우
  if (encryptedData.iv === 'fallback') {
    return decryptApiKeyFallback(encryptedData);
  }

  // Secure context에서 AES-GCM으로 저장된 경우
  if (isSecureContext() && crypto.subtle) {
    try {
      return await decryptApiKeySecure(encryptedData);
    } catch (error) {
      console.warn('Secure decryption failed:', error);
      // 기존 fallback 데이터일 수 있으므로 시도
      try {
        return decryptApiKeyFallback(encryptedData);
      } catch {
        throw error;
      }
    }
  }

  // HTTP 환경에서는 fallback 사용
  return decryptApiKeyFallback(encryptedData);
}

// API 키 저장
export async function saveApiKey(apiKey: string): Promise<void> {
  const encrypted = await encryptApiKey(apiKey);
  localStorage.setItem(STORAGE_KEYS.apiKey, JSON.stringify(encrypted));
}

// API 키 불러오기
export async function loadApiKey(): Promise<string | null> {
  const stored = localStorage.getItem(STORAGE_KEYS.apiKey);
  if (!stored) return null;

  try {
    const encryptedData: EncryptedApiKey = JSON.parse(stored);
    return await decryptApiKey(encryptedData);
  } catch (error) {
    console.error('Failed to load API key:', error);
    localStorage.removeItem(STORAGE_KEYS.apiKey);
    return null;
  }
}

// API 키 삭제
export function deleteApiKey(): void {
  localStorage.removeItem(STORAGE_KEYS.apiKey);
}

// API 키 존재 여부 확인
export function hasStoredApiKey(): boolean {
  return localStorage.getItem(STORAGE_KEYS.apiKey) !== null;
}

// API 키 마스킹 (앞 4자리만 표시)
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return '****';
  return apiKey.slice(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.slice(-4);
}

// 현재 보안 모드 확인
export function getSecurityMode(): 'secure' | 'fallback' {
  return isSecureContext() && crypto.subtle ? 'secure' : 'fallback';
}
