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

// ===== Phase 2: 이미지 생성 관련 타입 =====

// 이미지 비율
export type AspectRatio =
  | '1:1' | '2:3' | '3:2' | '3:4' | '4:3'
  | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'
  | 'original';  // 원본 비율 유지

// 이미지 해상도
export type Resolution = '1K' | '2K' | '4K';

// 이미지 생성 요청
export interface ImageGenerationRequest {
  originalImage: string;          // Base64
  translationResult: TranslationResult;
  aspectRatio: AspectRatio;
  resolution: Resolution;
}

// 이미지 생성 결과
export interface ImageGenerationResult {
  success: boolean;
  generatedImage?: string;        // Base64
  mimeType?: string;
  error?: string;
  thinkingText?: string;          // Thinking Mode 출력 (디버깅용)
}

// 이미지 생성 옵션
export interface ImageGenerationOptions {
  aspectRatio: AspectRatio;
  resolution: Resolution;
  autoGenerate: boolean;          // 번역 완료 후 자동 생성 여부
}

// 이미지 생성 설정 (API 호출용)
export interface ImageGenerationConfig {
  aspectRatio: Exclude<AspectRatio, 'original'>;  // API에는 original 제외
  resolution: Resolution;
}

// ===== Phase 3: 히스토리 관련 타입 =====

// DB 스키마 타입 re-export
export type {
  TranslationRecord,
  HistoryFilters,
  GetTranslationsOptions,
  StorageInfo,
  HistoryStatistics,
} from '../services/db/schema';

// ===== 앱 상태 =====

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

  // Image Generation (Phase 2)
  imageGenerationEnabled: boolean;
  setImageGenerationEnabled: (enabled: boolean) => void;
  defaultResolution: Resolution;
  setDefaultResolution: (resolution: Resolution) => void;
  defaultAspectRatio: AspectRatio;
  setDefaultAspectRatio: (aspectRatio: AspectRatio) => void;

  // History (Phase 3)
  showHistoryPanel: boolean;
  setShowHistoryPanel: (value: boolean) => void;
  autoSaveHistory: boolean;
  setAutoSaveHistory: (value: boolean) => void;
}
