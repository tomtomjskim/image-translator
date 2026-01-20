// 번역 결과 타입
export interface TranslationResult {
  id: string;
  imageUrl: string;
  originalText: string;
  translatedText: string;
  detectedLanguage: string;
  targetLanguage: string;
  confidence: 'high' | 'medium' | 'low';
  timestamp: number;
}

// 이미지 아이템 타입
export interface ImageItem {
  id: string;
  file?: File;
  url?: string;
  preview: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: TranslationResult;
  error?: string;
}

// 언어 옵션
export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
}

// 앱 설정
export interface AppSettings {
  sourceLanguage: string;
  targetLanguage: string;
  translationTone: 'general' | 'product' | 'formal';
}

// API 키 저장 형식
export interface EncryptedApiKey {
  encrypted: string;
  iv: string;
}

// Gemini API 응답 타입
export interface GeminiOCRResponse {
  detected_language: string;
  original_text: string;
  translated_text: string;
  confidence: 'high' | 'medium' | 'low';
}

// 앱 상태
export interface AppState {
  // API Key
  hasApiKey: boolean;
  setHasApiKey: (value: boolean) => void;

  // Images
  images: ImageItem[];
  addImages: (items: ImageItem[]) => void;
  updateImage: (id: string, updates: Partial<ImageItem>) => void;
  removeImage: (id: string) => void;
  clearImages: () => void;

  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;

  // UI State
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
  showApiKeyModal: boolean;
  setShowApiKeyModal: (value: boolean) => void;
}
