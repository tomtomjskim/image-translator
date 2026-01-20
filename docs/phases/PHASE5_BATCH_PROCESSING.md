# Phase 5: 다중 이미지 일괄 처리 개선 상세 구현 가이드

## 문서 정보

| 항목 | 내용 |
|------|------|
| **Phase** | 5 |
| **기능** | 다중 이미지 병렬 처리 및 UX 개선 |
| **우선순위** | P2 (중요) |
| **예상 소요** | 1주 |
| **상태** | 📋 설계 완료 |
| **의존성** | Phase 2, 3 완료 권장 |

---

## 1. 현재 문제점 분석

### 1.1 기존 구현 이슈

| 문제 | 영향 | 우선순위 |
|------|------|----------|
| 순차 처리 | 10개 이미지 시 10배 대기 시간 | 높음 |
| 진행 상태 불명확 | 사용자 이탈 | 높음 |
| 일부 실패 시 전체 중단 | 작업 손실 | 중간 |
| 메모리 부족 가능 | 브라우저 크래시 | 중간 |
| 결과 관리 어려움 | 사용성 저하 | 낮음 |

### 1.2 개선 목표
- 병렬 처리로 처리 시간 50% 이상 단축
- 실시간 진행 상태 표시
- 부분 실패 허용 및 재시도
- 메모리 효율적 처리
- 결과 일괄 관리

---

## 2. 아키텍처 설계

### 2.1 처리 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                    다중 이미지 처리 Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 이미지 업로드 (N개)                                          │
│     ↓                                                           │
│  2. 이미지 전처리 (리사이징, Base64 변환)                         │
│     ↓                                                           │
│  3. 처리 큐에 추가                                               │
│     ↓                                                           │
│  4. 병렬 처리 (동시성 제한: 3개)                                  │
│     ├── Worker 1: 이미지 1, 4, 7...                             │
│     ├── Worker 2: 이미지 2, 5, 8...                             │
│     └── Worker 3: 이미지 3, 6, 9...                             │
│     ↓                                                           │
│  5. 결과 수집 (성공/실패 분류)                                    │
│     ↓                                                           │
│  6. 결과 표시 및 일괄 작업                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 상태 관리

```typescript
// src/types/batch.ts

export interface BatchJob {
  id: string;
  status: BatchStatus;
  createdAt: Date;
  completedAt?: Date;

  // 전체 진행률
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };

  // 개별 이미지 상태
  items: BatchItem[];

  // 설정
  options: TranslationOptions;
}

export interface BatchItem {
  id: string;
  imageId: string;
  imageName: string;
  status: ItemStatus;
  startedAt?: Date;
  completedAt?: Date;

  // 결과
  result?: TranslationResult;
  error?: string;

  // 재시도
  retryCount: number;
  maxRetries: number;
}

export type BatchStatus =
  | 'pending'      // 대기 중
  | 'processing'   // 처리 중
  | 'completed'    // 완료
  | 'cancelled'    // 취소됨
  | 'failed';      // 실패

export type ItemStatus =
  | 'queued'       // 큐 대기
  | 'processing'   // 처리 중
  | 'completed'    // 성공
  | 'failed'       // 실패
  | 'retrying';    // 재시도 중
```

---

## 3. 서비스 레이어

### 3.1 배치 프로세서

```typescript
// src/services/batchProcessor.ts

import { translateImage } from './gemini';
import type { BatchJob, BatchItem, TranslationOptions, ImageItem } from '../types';

interface BatchProcessorOptions {
  concurrency: number;        // 동시 처리 수 (기본: 3)
  maxRetries: number;         // 최대 재시도 횟수 (기본: 2)
  retryDelay: number;         // 재시도 대기 시간 (ms)
  onProgress: (job: BatchJob) => void;
  onItemComplete: (item: BatchItem) => void;
  onItemError: (item: BatchItem, error: Error) => void;
}

export class BatchProcessor {
  private job: BatchJob;
  private options: BatchProcessorOptions;
  private abortController: AbortController;
  private activeWorkers: number = 0;

  constructor(
    images: ImageItem[],
    translationOptions: TranslationOptions,
    options: Partial<BatchProcessorOptions> = {}
  ) {
    this.options = {
      concurrency: 3,
      maxRetries: 2,
      retryDelay: 1000,
      onProgress: () => {},
      onItemComplete: () => {},
      onItemError: () => {},
      ...options,
    };

    this.abortController = new AbortController();

    this.job = this.createJob(images, translationOptions);
  }

  private createJob(images: ImageItem[], options: TranslationOptions): BatchJob {
    return {
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date(),
      progress: {
        total: images.length,
        completed: 0,
        failed: 0,
        percentage: 0,
      },
      items: images.map((img) => ({
        id: crypto.randomUUID(),
        imageId: img.id,
        imageName: img.name || `image_${img.id}`,
        status: 'queued',
        retryCount: 0,
        maxRetries: this.options.maxRetries,
      })),
      options,
    };
  }

  async start(): Promise<BatchJob> {
    this.job.status = 'processing';
    this.updateProgress();

    const queue = [...this.job.items];

    // 동시성 제한을 위한 세마포어 패턴
    const processNext = async (): Promise<void> => {
      while (queue.length > 0 && !this.abortController.signal.aborted) {
        const item = queue.shift();
        if (!item) break;

        this.activeWorkers++;
        await this.processItem(item);
        this.activeWorkers--;

        this.updateProgress();
      }
    };

    // 동시 워커 시작
    const workers = Array(Math.min(this.options.concurrency, queue.length))
      .fill(null)
      .map(() => processNext());

    await Promise.all(workers);

    // 최종 상태 결정
    if (this.abortController.signal.aborted) {
      this.job.status = 'cancelled';
    } else if (this.job.progress.failed === this.job.progress.total) {
      this.job.status = 'failed';
    } else {
      this.job.status = 'completed';
    }

    this.job.completedAt = new Date();
    this.updateProgress();

    return this.job;
  }

  private async processItem(item: BatchItem): Promise<void> {
    item.status = 'processing';
    item.startedAt = new Date();
    this.updateProgress();

    try {
      // 이미지 데이터 가져오기
      const imageItem = await this.getImageData(item.imageId);

      // 번역 실행
      const result = await translateImage(
        imageItem.base64,
        this.job.options.sourceLanguage,
        this.job.options.targetLanguage,
        this.job.options
      );

      item.status = 'completed';
      item.result = result;
      item.completedAt = new Date();
      this.job.progress.completed++;
      this.options.onItemComplete(item);

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');

      // 재시도 로직
      if (item.retryCount < item.maxRetries) {
        item.status = 'retrying';
        item.retryCount++;
        this.updateProgress();

        await this.delay(this.options.retryDelay * item.retryCount);

        // 재시도를 위해 큐에 다시 추가하지 않고 직접 처리
        return this.processItem(item);
      }

      item.status = 'failed';
      item.error = err.message;
      item.completedAt = new Date();
      this.job.progress.failed++;
      this.options.onItemError(item, err);
    }
  }

  private async getImageData(imageId: string): Promise<ImageItem> {
    // Store에서 이미지 데이터 가져오기
    const store = useAppStore.getState();
    const image = store.images.find((img) => img.id === imageId);

    if (!image) {
      throw new Error(`Image not found: ${imageId}`);
    }

    return image;
  }

  private updateProgress(): void {
    const { total, completed, failed } = this.job.progress;
    this.job.progress.percentage = total > 0
      ? Math.round(((completed + failed) / total) * 100)
      : 0;

    this.options.onProgress({ ...this.job });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  cancel(): void {
    this.abortController.abort();
  }

  getJob(): BatchJob {
    return { ...this.job };
  }
}
```

### 3.2 배치 매니저

```typescript
// src/services/batchManager.ts

import { BatchProcessor } from './batchProcessor';
import type { BatchJob, ImageItem, TranslationOptions } from '../types';

class BatchManager {
  private currentJob: BatchProcessor | null = null;
  private listeners: Set<(job: BatchJob) => void> = new Set();

  async startBatch(
    images: ImageItem[],
    options: TranslationOptions
  ): Promise<BatchJob> {
    if (this.currentJob) {
      throw new Error('A batch is already in progress');
    }

    const processor = new BatchProcessor(images, options, {
      concurrency: 3,
      maxRetries: 2,
      onProgress: (job) => this.notifyListeners(job),
      onItemComplete: (item) => console.log(`Completed: ${item.imageName}`),
      onItemError: (item, err) => console.error(`Failed: ${item.imageName}`, err),
    });

    this.currentJob = processor;

    try {
      const result = await processor.start();
      return result;
    } finally {
      this.currentJob = null;
    }
  }

  cancelBatch(): void {
    if (this.currentJob) {
      this.currentJob.cancel();
    }
  }

  getCurrentJob(): BatchJob | null {
    return this.currentJob?.getJob() || null;
  }

  subscribe(listener: (job: BatchJob) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(job: BatchJob): void {
    this.listeners.forEach((listener) => listener(job));
  }
}

export const batchManager = new BatchManager();
```

---

## 4. 컴포넌트 설계

### 4.1 디렉토리 구조

```
src/components/Batch/
├── index.ts
├── BatchProgress.tsx           # 전체 진행 상태
├── BatchItemList.tsx           # 개별 아이템 목록
├── BatchItem.tsx               # 개별 아이템 상태
├── BatchResults.tsx            # 결과 요약
├── BatchActions.tsx            # 일괄 작업 버튼
└── BatchConfirmModal.tsx       # 시작 확인 모달
```

### 4.2 BatchProgress 컴포넌트

```tsx
// src/components/Batch/BatchProgress.tsx

import type { BatchJob } from '../../types';

interface Props {
  job: BatchJob;
  onCancel: () => void;
}

export function BatchProgress({ job, onCancel }: Props) {
  const { progress } = job;
  const isProcessing = job.status === 'processing';

  return (
    <div className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          일괄 번역 {isProcessing ? '진행 중' : '완료'}
        </h3>
        {isProcessing && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
          >
            취소
          </button>
        )}
      </div>

      {/* 프로그레스 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400 mb-1">
          <span>진행률</span>
          <span>{progress.percentage}%</span>
        </div>
        <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">
            {progress.total}
          </p>
          <p className="text-xs text-slate-500">전체</p>
        </div>
        <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {progress.completed}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400">성공</p>
        </div>
        <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {progress.failed}
          </p>
          <p className="text-xs text-red-600 dark:text-red-400">실패</p>
        </div>
      </div>
    </div>
  );
}
```

### 4.3 BatchItemList 컴포넌트

```tsx
// src/components/Batch/BatchItemList.tsx

import { BatchItem } from './BatchItem';
import type { BatchItem as BatchItemType } from '../../types';

interface Props {
  items: BatchItemType[];
  onRetry: (itemId: string) => void;
  onViewResult: (itemId: string) => void;
}

export function BatchItemList({ items, onRetry, onViewResult }: Props) {
  return (
    <div className="mt-6 max-h-96 overflow-y-auto space-y-2">
      {items.map((item) => (
        <BatchItem
          key={item.id}
          item={item}
          onRetry={() => onRetry(item.id)}
          onViewResult={() => onViewResult(item.id)}
        />
      ))}
    </div>
  );
}
```

### 4.4 BatchItem 컴포넌트

```tsx
// src/components/Batch/BatchItem.tsx

import type { BatchItem as BatchItemType } from '../../types';

interface Props {
  item: BatchItemType;
  onRetry: () => void;
  onViewResult: () => void;
}

const STATUS_CONFIG = {
  queued: { icon: '○', color: 'text-slate-400', label: '대기 중' },
  processing: { icon: '⟳', color: 'text-blue-500 animate-spin', label: '처리 중' },
  completed: { icon: '✓', color: 'text-green-500', label: '완료' },
  failed: { icon: '✗', color: 'text-red-500', label: '실패' },
  retrying: { icon: '↻', color: 'text-yellow-500 animate-spin', label: '재시도 중' },
};

export function BatchItem({ item, onRetry, onViewResult }: Props) {
  const config = STATUS_CONFIG[item.status];

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
      {/* 상태 아이콘 */}
      <span className={`text-lg ${config.color}`}>
        {config.icon}
      </span>

      {/* 파일명 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
          {item.imageName}
        </p>
        <p className="text-xs text-slate-500">
          {config.label}
          {item.retryCount > 0 && ` (재시도 ${item.retryCount}회)`}
        </p>
      </div>

      {/* 액션 */}
      {item.status === 'completed' && (
        <button
          onClick={onViewResult}
          className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
        >
          보기
        </button>
      )}
      {item.status === 'failed' && (
        <button
          onClick={onRetry}
          className="px-3 py-1 text-xs text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded"
        >
          재시도
        </button>
      )}

      {/* 에러 메시지 */}
      {item.error && (
        <span className="text-xs text-red-500 truncate max-w-32" title={item.error}>
          {item.error}
        </span>
      )}
    </div>
  );
}
```

---

## 5. Hook 설계

```typescript
// src/hooks/useBatchTranslation.ts

import { useState, useCallback, useEffect } from 'react';
import { batchManager } from '../services/batchManager';
import type { BatchJob, ImageItem, TranslationOptions } from '../types';

export function useBatchTranslation() {
  const [job, setJob] = useState<BatchJob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // 진행 상태 구독
    const unsubscribe = batchManager.subscribe((updatedJob) => {
      setJob({ ...updatedJob });
    });

    return unsubscribe;
  }, []);

  const startBatch = useCallback(async (
    images: ImageItem[],
    options: TranslationOptions
  ) => {
    setIsProcessing(true);
    try {
      const result = await batchManager.startBatch(images, options);
      setJob(result);
      return result;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const cancelBatch = useCallback(() => {
    batchManager.cancelBatch();
  }, []);

  const retryFailed = useCallback(async () => {
    if (!job) return;

    const failedItems = job.items.filter((item) => item.status === 'failed');
    if (failedItems.length === 0) return;

    // 실패한 항목만 다시 처리
    const failedImages = failedItems.map((item) => ({
      id: item.imageId,
      name: item.imageName,
    }));

    // 새 배치 시작
    await startBatch(failedImages as ImageItem[], job.options);
  }, [job, startBatch]);

  return {
    job,
    isProcessing,
    startBatch,
    cancelBatch,
    retryFailed,
  };
}
```

---

## 6. 메모리 최적화

### 6.1 이미지 청크 처리

```typescript
// src/utils/imageChunker.ts

export async function* processImagesInChunks<T>(
  images: ImageItem[],
  processor: (image: ImageItem) => Promise<T>,
  chunkSize: number = 5
): AsyncGenerator<T> {
  for (let i = 0; i < images.length; i += chunkSize) {
    const chunk = images.slice(i, i + chunkSize);

    // 청크 처리
    const results = await Promise.all(chunk.map(processor));

    for (const result of results) {
      yield result;
    }

    // 메모리 정리를 위한 짧은 지연
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
```

### 6.2 이미지 리사이징

```typescript
// src/utils/imageResize.ts

export async function resizeImageForProcessing(
  base64: string,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // 비율 유지하며 리사이징
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const resized = canvas.toDataURL('image/jpeg', quality);

      resolve(resized.split(',')[1]); // Base64 부분만 반환
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}
```

---

## 7. 구현 체크리스트

### 7.1 서비스
- [ ] BatchProcessor 클래스
- [ ] BatchManager 싱글톤
- [ ] 이미지 청크 처리
- [ ] 이미지 리사이징

### 7.2 컴포넌트
- [ ] BatchProgress
- [ ] BatchItemList
- [ ] BatchItem
- [ ] BatchResults
- [ ] BatchConfirmModal

### 7.3 Hook
- [ ] useBatchTranslation

### 7.4 통합
- [ ] 메인 UI에 일괄 처리 모드 추가
- [ ] Store 상태 업데이트

---

## 8. 성능 목표

| 지표 | 현재 | 목표 |
|------|------|------|
| 10개 이미지 처리 시간 | ~30초 | ~12초 |
| 동시 처리 수 | 1 | 3 |
| 메모리 사용량 | 무제한 | 청크당 100MB |
| 재시도 성공률 | 0% | 70%+ |

---

*문서 버전: 1.0.0*
*최종 수정: 2026-01-20*
