// 번역 기록 데이터 모델

export interface TranslationRecord {
  id: string;                     // UUID
  createdAt: Date;
  updatedAt: Date;

  // 이미지 정보
  image: {
    thumbnail: string;            // 압축된 썸네일 (Base64, ~50KB)
    originalSize: number;         // 원본 크기 (bytes)
    mimeType: string;
  };

  // 번역 정보
  sourceLanguage: string;
  targetLanguage: string;
  originalText: string;
  translatedText: string;

  // 생성된 이미지 (선택적)
  generatedImage?: {
    data: string;                 // Base64
    resolution: string;
    aspectRatio: string;
  };

  // 메타데이터
  metadata: {
    confidence: 'high' | 'medium' | 'low';
    processingTime: number;       // ms
    modelUsed: string;
  };

  // 사용자 메모 (선택적)
  notes?: string;
  tags?: string[];
  isFavorite: boolean;
}

// 설정 저장용
export interface SettingsRecord {
  key: string;
  value: unknown;
}

// 히스토리 필터 옵션
export interface HistoryFilters {
  searchQuery: string;
  sourceLanguage: string;
  targetLanguage: string;
  favoritesOnly: boolean;
}

// 히스토리 조회 옵션
export interface GetTranslationsOptions {
  page?: number;
  limit?: number;
  sourceLanguage?: string;
  targetLanguage?: string;
  searchQuery?: string;
  favoritesOnly?: boolean;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// 스토리지 정보
export interface StorageInfo {
  used: number;
  quota: number;
  percentage: number;
}

// 통계 정보
export interface HistoryStatistics {
  totalCount: number;
  languagePairs: { source: string; target: string; count: number }[];
  storageUsed: number;
}
