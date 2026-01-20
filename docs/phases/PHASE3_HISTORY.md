# Phase 3: 번역 히스토리 저장 상세 구현 가이드

## 문서 정보

| 항목 | 내용 |
|------|------|
| **Phase** | 3 |
| **기능** | IndexedDB 기반 번역 히스토리 |
| **우선순위** | P1 (핵심) |
| **예상 소요** | 1주 |
| **상태** | 📋 설계 완료 |
| **의존성** | Phase 2 완료 권장 |

---

## 1. 기능 개요

### 1.1 목적
- 번역 결과를 브라우저에 영구 저장
- 이전 번역 재사용으로 생산성 향상
- 번역 히스토리 검색 및 관리

### 1.2 주요 기능
- 자동 저장: 번역 완료 시 자동 저장
- 검색: 원문/번역문 검색
- 필터: 언어, 날짜별 필터링
- 내보내기: JSON/CSV 일괄 내보내기
- 저장 용량 관리: 오래된 항목 자동 삭제 옵션

---

## 2. 기술 선택

### 2.1 IndexedDB vs localStorage

| 항목 | IndexedDB | localStorage |
|------|-----------|--------------|
| 용량 | ~수백 MB | ~5-10 MB |
| 데이터 구조 | 객체, 배열 지원 | 문자열만 |
| 인덱싱 | 지원 | 미지원 |
| 검색 성능 | 빠름 | 느림 |
| 비동기 | 지원 | 미지원 |

**선택**: IndexedDB (Dexie.js 래퍼 사용)

### 2.2 Dexie.js 선택 이유
- IndexedDB의 복잡한 API를 간단하게 추상화
- Promise 기반 API
- TypeScript 지원
- 마이그레이션 지원
- 번들 크기: ~27KB (gzipped)

---

## 3. 데이터 모델

### 3.1 스키마 정의

```typescript
// src/services/db/schema.ts

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
  translationTone: TranslationTone;
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
```

### 3.2 인덱스 설계

```typescript
// 검색 및 필터링에 사용할 인덱스
indexes: {
  'by-date': 'createdAt',
  'by-source-lang': 'sourceLanguage',
  'by-target-lang': 'targetLanguage',
  'by-favorite': 'isFavorite',
  'compound': '[sourceLanguage+targetLanguage]',
}
```

---

## 4. 데이터베이스 서비스

### 4.1 Dexie 설정

```typescript
// src/services/db/index.ts

import Dexie, { type Table } from 'dexie';
import type { TranslationRecord } from './schema';

class TranslationDatabase extends Dexie {
  translations!: Table<TranslationRecord, string>;
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('ImageTranslatorDB');

    this.version(1).stores({
      translations: 'id, createdAt, sourceLanguage, targetLanguage, isFavorite, [sourceLanguage+targetLanguage]',
      settings: 'key',
    });
  }
}

export const db = new TranslationDatabase();
```

### 4.2 CRUD 함수

```typescript
// src/services/db/operations.ts

import { db } from './index';
import { v4 as uuidv4 } from 'uuid';
import { compressImage } from '../imageUtils';
import type { TranslationRecord, TranslationResult } from '../../types';

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
    translationTone: translation.tone,
    originalText: translation.originalText,
    translatedText: translation.translatedText,
    generatedImage: generatedImage ? {
      data: generatedImage,
      resolution: '2K',
      aspectRatio: '1:1',
    } : undefined,
    metadata: {
      confidence: translation.confidence,
      processingTime: translation.processingTime,
      modelUsed: 'gemini-2.0-flash-exp',
    },
    isFavorite: false,
  };

  await db.translations.add(record);
  return id;
}

// 조회 (페이지네이션)
export async function getTranslations(options: {
  page?: number;
  limit?: number;
  sourceLanguage?: string;
  targetLanguage?: string;
  searchQuery?: string;
  favoritesOnly?: boolean;
  sortBy?: 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}): Promise<{ records: TranslationRecord[]; total: number }> {
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

  let collection = db.translations.toCollection();

  // 필터링
  if (sourceLanguage) {
    collection = db.translations.where('sourceLanguage').equals(sourceLanguage);
  }
  if (targetLanguage) {
    collection = collection.filter(r => r.targetLanguage === targetLanguage);
  }
  if (favoritesOnly) {
    collection = collection.filter(r => r.isFavorite);
  }
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    collection = collection.filter(r =>
      r.originalText.toLowerCase().includes(query) ||
      r.translatedText.toLowerCase().includes(query)
    );
  }

  // 정렬
  if (sortOrder === 'desc') {
    collection = collection.reverse();
  }

  // 전체 개수
  const total = await collection.count();

  // 페이지네이션
  const records = await collection
    .offset((page - 1) * limit)
    .limit(limit)
    .sortBy(sortBy);

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
export async function getStatistics(): Promise<{
  totalCount: number;
  languagePairs: { source: string; target: string; count: number }[];
  storageUsed: number;
}> {
  const all = await db.translations.toArray();

  const languagePairs = all.reduce((acc, r) => {
    const key = `${r.sourceLanguage}-${r.targetLanguage}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalCount: all.length,
    languagePairs: Object.entries(languagePairs).map(([key, count]) => {
      const [source, target] = key.split('-');
      return { source, target, count };
    }),
    storageUsed: await navigator.storage?.estimate?.()
      .then(e => e.usage || 0)
      .catch(() => 0),
  };
}
```

### 4.3 내보내기 함수

```typescript
// src/services/db/export.ts

import { db } from './index';
import type { TranslationRecord } from './schema';

// JSON 내보내기
export async function exportToJSON(): Promise<string> {
  const records = await db.translations.toArray();

  // 이미지 데이터 제외 (용량 절약)
  const exportData = records.map(r => ({
    ...r,
    image: { ...r.image, thumbnail: '[EXCLUDED]' },
    generatedImage: r.generatedImage ? { ...r.generatedImage, data: '[EXCLUDED]' } : undefined,
  }));

  return JSON.stringify(exportData, null, 2);
}

// CSV 내보내기
export async function exportToCSV(): Promise<string> {
  const records = await db.translations.toArray();

  const headers = [
    'ID', 'Created At', 'Source Language', 'Target Language',
    'Original Text', 'Translated Text', 'Confidence', 'Is Favorite'
  ];

  const rows = records.map(r => [
    r.id,
    r.createdAt.toISOString(),
    r.sourceLanguage,
    r.targetLanguage,
    `"${r.originalText.replace(/"/g, '""')}"`,
    `"${r.translatedText.replace(/"/g, '""')}"`,
    r.metadata.confidence,
    r.isFavorite ? 'Yes' : 'No',
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

// 다운로드 트리거
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
```

---

## 5. 컴포넌트 설계

### 5.1 디렉토리 구조

```
src/components/History/
├── index.ts
├── HistoryPanel.tsx            # 메인 사이드 패널
├── HistoryList.tsx             # 히스토리 목록
├── HistoryItem.tsx             # 개별 아이템
├── HistorySearch.tsx           # 검색/필터
├── HistoryDetail.tsx           # 상세 보기 모달
├── HistoryExport.tsx           # 내보내기 버튼
└── HistoryStats.tsx            # 통계 표시
```

### 5.2 HistoryPanel 컴포넌트

```tsx
// src/components/History/HistoryPanel.tsx

import { useState, useEffect } from 'react';
import { HistorySearch } from './HistorySearch';
import { HistoryList } from './HistoryList';
import { HistoryExport } from './HistoryExport';
import { useHistory } from '../../hooks/useHistory';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (record: TranslationRecord) => void;
}

export function HistoryPanel({ isOpen, onClose, onSelect }: Props) {
  const {
    records,
    total,
    isLoading,
    filters,
    setFilters,
    loadMore,
    deleteRecord,
    toggleFavorite,
  } = useHistory();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-slate-800 shadow-xl z-50 flex flex-col">
      {/* 헤더 */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          번역 히스토리
        </h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      {/* 검색/필터 */}
      <HistorySearch filters={filters} onChange={setFilters} />

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto">
        <HistoryList
          records={records}
          isLoading={isLoading}
          onSelect={onSelect}
          onDelete={deleteRecord}
          onToggleFavorite={toggleFavorite}
          onLoadMore={loadMore}
          hasMore={records.length < total}
        />
      </div>

      {/* 하단 */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <span className="text-sm text-slate-500">
          총 {total}건
        </span>
        <HistoryExport />
      </div>
    </div>
  );
}
```

### 5.3 HistoryItem 컴포넌트

```tsx
// src/components/History/HistoryItem.tsx

import type { TranslationRecord } from '../../types';

interface Props {
  record: TranslationRecord;
  onSelect: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

export function HistoryItem({ record, onSelect, onDelete, onToggleFavorite }: Props) {
  return (
    <div
      className="p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer"
      onClick={onSelect}
    >
      <div className="flex gap-3">
        {/* 썸네일 */}
        <img
          src={`data:image/jpeg;base64,${record.image.thumbnail}`}
          alt="Thumbnail"
          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
        />

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          {/* 날짜 & 언어 */}
          <div className="flex justify-between items-start mb-1">
            <span className="text-xs text-slate-500">
              {new Date(record.createdAt).toLocaleDateString('ko-KR')}
            </span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-600 rounded">
              {record.sourceLanguage} → {record.targetLanguage}
            </span>
          </div>

          {/* 원문 (truncated) */}
          <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
            {record.originalText}
          </p>

          {/* 번역문 (truncated) */}
          <p className="text-sm text-slate-800 dark:text-slate-200 truncate font-medium">
            {record.translatedText}
          </p>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-end gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onToggleFavorite}
          className={`p-1.5 rounded ${
            record.isFavorite
              ? 'text-yellow-500'
              : 'text-slate-400 hover:text-yellow-500'
          }`}
        >
          <StarIcon className="w-4 h-4" filled={record.isFavorite} />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded text-slate-400 hover:text-red-500"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

---

## 6. Hook 설계

```typescript
// src/hooks/useHistory.ts

import { useState, useEffect, useCallback } from 'react';
import {
  getTranslations,
  deleteTranslation,
  toggleFavorite as toggleFavoriteDB,
} from '../services/db/operations';
import type { TranslationRecord } from '../types';

interface HistoryFilters {
  searchQuery: string;
  sourceLanguage: string;
  targetLanguage: string;
  favoritesOnly: boolean;
}

export function useHistory() {
  const [records, setRecords] = useState<TranslationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<HistoryFilters>({
    searchQuery: '',
    sourceLanguage: '',
    targetLanguage: '',
    favoritesOnly: false,
  });

  const loadRecords = useCallback(async (reset = false) => {
    setIsLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      const { records: newRecords, total: newTotal } = await getTranslations({
        page: currentPage,
        limit: 20,
        ...filters,
      });

      if (reset) {
        setRecords(newRecords);
        setPage(1);
      } else {
        setRecords((prev) => [...prev, ...newRecords]);
      }
      setTotal(newTotal);
    } finally {
      setIsLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    loadRecords(true);
  }, [filters]);

  const loadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  useEffect(() => {
    if (page > 1) {
      loadRecords(false);
    }
  }, [page]);

  const deleteRecord = useCallback(async (id: string) => {
    await deleteTranslation(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
    setTotal((t) => t - 1);
  }, []);

  const toggleFavorite = useCallback(async (id: string) => {
    const newValue = await toggleFavoriteDB(id);
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isFavorite: newValue } : r))
    );
  }, []);

  return {
    records,
    total,
    isLoading,
    filters,
    setFilters,
    loadMore,
    deleteRecord,
    toggleFavorite,
    refresh: () => loadRecords(true),
  };
}
```

---

## 7. 자동 저장 통합

```typescript
// src/hooks/useTranslation.ts 수정

import { saveTranslation } from '../services/db/operations';

// translateImage 함수 내부에 추가
const result = await performOCRAndTranslation(...);

// 자동 저장 (설정에 따라)
if (settings.autoSaveHistory) {
  await saveTranslation(imageBase64, result);
}
```

---

## 8. 스토리지 관리

### 8.1 용량 모니터링

```typescript
// src/services/db/storage.ts

export async function getStorageInfo(): Promise<{
  used: number;
  quota: number;
  percentage: number;
}> {
  if (!navigator.storage?.estimate) {
    return { used: 0, quota: 0, percentage: 0 };
  }

  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return {
    used: usage,
    quota: quota,
    percentage: quota > 0 ? (usage / quota) * 100 : 0,
  };
}
```

### 8.2 자동 정리

```typescript
// src/services/db/cleanup.ts

export async function cleanupOldRecords(options: {
  maxAge?: number;      // 일 단위
  maxCount?: number;    // 최대 개수
}): Promise<number> {
  const { maxAge = 90, maxCount = 1000 } = options;

  let deletedCount = 0;

  // 오래된 항목 삭제
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAge);

  const oldRecords = await db.translations
    .where('createdAt')
    .below(cutoffDate)
    .filter(r => !r.isFavorite)  // 즐겨찾기 제외
    .toArray();

  if (oldRecords.length > 0) {
    await db.translations.bulkDelete(oldRecords.map(r => r.id));
    deletedCount += oldRecords.length;
  }

  // 최대 개수 초과 시 삭제
  const totalCount = await db.translations.count();
  if (totalCount > maxCount) {
    const excess = totalCount - maxCount;
    const oldestRecords = await db.translations
      .orderBy('createdAt')
      .filter(r => !r.isFavorite)
      .limit(excess)
      .toArray();

    await db.translations.bulkDelete(oldestRecords.map(r => r.id));
    deletedCount += oldestRecords.length;
  }

  return deletedCount;
}
```

---

## 9. 구현 체크리스트

### 9.1 데이터베이스
- [ ] Dexie.js 설치 (`npm install dexie`)
- [ ] 스키마 정의
- [ ] CRUD 함수 구현
- [ ] 내보내기 함수

### 9.2 컴포넌트
- [ ] HistoryPanel
- [ ] HistoryList
- [ ] HistoryItem
- [ ] HistorySearch
- [ ] HistoryExport

### 9.3 Hook
- [ ] useHistory

### 9.4 통합
- [ ] 자동 저장 로직
- [ ] 메인 UI에 히스토리 버튼 추가
- [ ] 스토리지 관리

---

## 10. 의존성

```json
{
  "dependencies": {
    "dexie": "^4.0.0",
    "uuid": "^9.0.0"
  }
}
```

---

*문서 버전: 1.0.0*
*최종 수정: 2026-01-20*
