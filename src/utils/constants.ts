import type { LanguageOption } from '../types';

// 지원 언어 목록
export const LANGUAGES: LanguageOption[] = [
  { code: 'auto', name: 'Auto Detect', nativeName: '자동 감지' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
];

// 타겟 언어 (자동감지 제외)
export const TARGET_LANGUAGES = LANGUAGES.filter(lang => lang.code !== 'auto');

// 번역 톤 옵션
export const TRANSLATION_TONES = [
  { value: 'general', label: '일반', description: '자연스러운 번역' },
  { value: 'product', label: '상품설명', description: '이커머스 최적화' },
  { value: 'formal', label: '격식체', description: '공식적인 톤' },
] as const;

// 이미지 설정
export const IMAGE_CONFIG = {
  maxSize: 10 * 1024 * 1024, // 10MB
  maxCount: 10,
  acceptedTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
  acceptedExtensions: '.png,.jpg,.jpeg,.webp,.gif',
};

// Gemini 모델 설정
export const GEMINI_CONFIG = {
  ocrModel: 'gemini-2.0-flash-exp', // OCR + 번역용
  imageModel: 'gemini-3-pro-image-preview', // 이미지 생성용 (Nano Banana Pro)
};

// 로컬 스토리지 키
export const STORAGE_KEYS = {
  apiKey: 'img_translator_api_key',
  settings: 'img_translator_settings',
};
