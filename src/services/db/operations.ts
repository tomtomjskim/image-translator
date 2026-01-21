import { v4 as uuidv4 } from 'uuid';
import { db } from './index';
import type {
  TranslationRecord,
  GetTranslationsOptions,
  HistoryStatistics
} from './schema';
import type { TranslationResult } from '../../types';

// 이미지 압축 (썸네일 생성)
async function compressImage(base64: string, options: { maxWidth: number; quality: number }): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // 비율 유지하며 리사이즈
      const ratio = options.maxWidth / img.width;
      canvas.width = options.maxWidth;
      canvas.height = img.height * ratio;

      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Base64로 변환 (JPEG, 품질 조절)
      const compressed = canvas.toDataURL('image/jpeg', options.quality);
      resolve(compressed.split(',')[1] || compressed);
    };
    img.onerror = () => resolve(base64); // 실패 시 원본 반환

    // data URL 형식 확인
    if (base64.startsWith('data:')) {
      img.src = base64;
    } else {
      img.src = `data:image/jpeg;base64,${base64}`;
    }
  });
}

// 저장
export async function saveTranslation(
  imageBase64: string,
  translation: TranslationResult,
  generatedImage?: string
): Promise<string> {
  const id = uuidv4();
  const thumbnail = await compressImage(imageBase64, { maxWidth: 200, quality: 0.7 });

  const record: TranslationRecord = {
    id,
    createdAt: new Date(),
    updatedAt: new Date(),
    image: {
      thumbnail,
      originalSize: imageBase64.length,
      mimeType: 'image/jpeg',
    },
    sourceLanguage: translation.detectedLanguage,
    targetLanguage: translation.targetLanguage,
    originalText: translation.originalText,
    translatedText: translation.translatedText,
    generatedImage: generatedImage ? {
      data: generatedImage,
      resolution: '2K',
      aspectRatio: '1:1',
    } : undefined,
    metadata: {
      confidence: translation.confidence,
      processingTime: Date.now() - translation.timestamp,
      modelUsed: 'gemini-2.0-flash-exp',
    },
    isFavorite: false,
  };

  await db.translations.add(record);
  return id;
}

// 조회 (페이지네이션)
export async function getTranslations(options: GetTranslationsOptions): Promise<{
  records: TranslationRecord[];
  total: number
}> {
  const {
    page = 1,
    limit = 20,
    sourceLanguage,
    targetLanguage,
    searchQuery,
    favoritesOnly,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = options;

  // 모든 레코드 가져오기
  let allRecords = await db.translations.toArray();

  // 필터링
  if (sourceLanguage) {
    allRecords = allRecords.filter(r => r.sourceLanguage === sourceLanguage);
  }
  if (targetLanguage) {
    allRecords = allRecords.filter(r => r.targetLanguage === targetLanguage);
  }
  if (favoritesOnly) {
    allRecords = allRecords.filter(r => r.isFavorite);
  }
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    allRecords = allRecords.filter(r =>
      r.originalText.toLowerCase().includes(query) ||
      r.translatedText.toLowerCase().includes(query)
    );
  }

  // 정렬
  allRecords.sort((a, b) => {
    const aVal = a[sortBy]?.getTime?.() || 0;
    const bVal = b[sortBy]?.getTime?.() || 0;
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  // 전체 개수
  const total = allRecords.length;

  // 페이지네이션
  const startIndex = (page - 1) * limit;
  const records = allRecords.slice(startIndex, startIndex + limit);

  return { records, total };
}

// 단일 조회
export async function getTranslation(id: string): Promise<TranslationRecord | undefined> {
  return db.translations.get(id);
}

// 업데이트
export async function updateTranslation(
  id: string,
  updates: Partial<TranslationRecord>
): Promise<void> {
  await db.translations.update(id, {
    ...updates,
    updatedAt: new Date(),
  });
}

// 삭제
export async function deleteTranslation(id: string): Promise<void> {
  await db.translations.delete(id);
}

// 일괄 삭제
export async function deleteTranslations(ids: string[]): Promise<void> {
  await db.translations.bulkDelete(ids);
}

// 전체 삭제
export async function clearAllTranslations(): Promise<void> {
  await db.translations.clear();
}

// 즐겨찾기 토글
export async function toggleFavorite(id: string): Promise<boolean> {
  const record = await db.translations.get(id);
  if (!record) return false;

  const newValue = !record.isFavorite;
  await db.translations.update(id, { isFavorite: newValue, updatedAt: new Date() });
  return newValue;
}

// 통계
export async function getStatistics(): Promise<HistoryStatistics> {
  const all = await db.translations.toArray();

  const languagePairMap = all.reduce((acc, r) => {
    const key = `${r.sourceLanguage}|${r.targetLanguage}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let storageUsed = 0;
  try {
    const estimate = await navigator.storage?.estimate?.();
    storageUsed = estimate?.usage || 0;
  } catch {
    storageUsed = 0;
  }

  return {
    totalCount: all.length,
    languagePairs: Object.entries(languagePairMap).map(([key, count]) => {
      const [source, target] = key.split('|');
      return { source, target, count };
    }),
    storageUsed,
  };
}

// 스토리지 정보
export async function getStorageInfo(): Promise<{
  used: number;
  quota: number;
  percentage: number;
}> {
  if (!navigator.storage?.estimate) {
    return { used: 0, quota: 0, percentage: 0 };
  }

  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return {
      used: usage,
      quota: quota,
      percentage: quota > 0 ? (usage / quota) * 100 : 0,
    };
  } catch {
    return { used: 0, quota: 0, percentage: 0 };
  }
}

// 자동 정리 (오래된 레코드 삭제)
export async function cleanupOldRecords(options: {
  maxAge?: number;      // 일 단위
  maxCount?: number;    // 최대 개수
}): Promise<number> {
  const { maxAge = 90, maxCount = 1000 } = options;

  let deletedCount = 0;

  // 오래된 항목 삭제
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAge);

  const allRecords = await db.translations.toArray();
  const oldRecords = allRecords.filter(r =>
    r.createdAt < cutoffDate && !r.isFavorite
  );

  if (oldRecords.length > 0) {
    await db.translations.bulkDelete(oldRecords.map(r => r.id));
    deletedCount += oldRecords.length;
  }

  // 최대 개수 초과 시 삭제
  const totalCount = await db.translations.count();
  if (totalCount > maxCount) {
    const excess = totalCount - maxCount;
    const sortedRecords = allRecords
      .filter(r => !r.isFavorite)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(0, excess);

    await db.translations.bulkDelete(sortedRecords.map(r => r.id));
    deletedCount += sortedRecords.length;
  }

  return deletedCount;
}
