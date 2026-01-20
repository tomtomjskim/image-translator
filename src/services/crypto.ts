import type { EncryptedApiKey } from '../types';
import { STORAGE_KEYS } from '../utils/constants';

// 브라우저 핑거프린트 기반 암호화 키 생성
async function getEncryptionKey(): Promise<CryptoKey> {
  // 간단한 브라우저 핑거프린트 생성
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
  ].join('|');

  // 핑거프린트를 기반으로 키 생성
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

// API 키 암호화
export async function encryptApiKey(apiKey: string): Promise<EncryptedApiKey> {
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);

  // 랜덤 IV 생성
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 암호화
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // Base64로 인코딩
  const encrypted = btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
  const ivString = btoa(String.fromCharCode(...iv));

  return { encrypted, iv: ivString };
}

// API 키 복호화
export async function decryptApiKey(encryptedData: EncryptedApiKey): Promise<string> {
  const key = await getEncryptionKey();

  // Base64 디코딩
  const encryptedBytes = Uint8Array.from(atob(encryptedData.encrypted), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));

  // 복호화
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedBytes
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
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
  } catch {
    // 복호화 실패 시 저장된 키 삭제
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
