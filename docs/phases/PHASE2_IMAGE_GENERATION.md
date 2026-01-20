# Phase 2: 번역 이미지 자동 생성 상세 구현 가이드

## 문서 정보

| 항목 | 내용 |
|------|------|
| **Phase** | 2 |
| **기능** | Nano Banana Pro 번역 이미지 생성 |
| **우선순위** | P1 (핵심) |
| **예상 소요** | 2주 |
| **상태** | 📋 설계 완료 |
| **의존성** | Phase 1 (HTTPS) 완료 필요 |

---

## 1. 기능 개요

### 1.1 목적
- OCR + 번역 후 원본 이미지의 텍스트를 번역된 텍스트로 교체한 새 이미지 생성
- 해외 소싱 상품 이미지를 한국어로 자동 변환

### 1.2 사용 모델

| 용도 | 모델 ID | 특징 |
|------|---------|------|
| 이미지 생성 | `gemini-3-pro-image-preview` | Nano Banana Pro, Thinking Mode 자동 활성화 |

### 1.3 Nano Banana Pro 특성
- **Thinking Mode**: 항상 활성화 (비활성화 불가)
  - 복잡한 프롬프트를 chain-of-thought 추론으로 처리
  - 최종 출력 전 내부적으로 'thought images' 생성
- **지원 해상도**: 1K, 2K, 4K
- **지원 비율**: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
- **텍스트 렌더링**: 가독성 높은 스타일 텍스트 지원

---

## 2. API 설계

### 2.1 Gemini API 설정

```typescript
// src/services/imageGeneration.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_CONFIG } from '../utils/constants';

interface ImageGenerationConfig {
  aspectRatio: AspectRatio;
  resolution: Resolution;
}

type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
type Resolution = '1K' | '2K' | '4K';

export async function generateTranslatedImage(
  genAI: GoogleGenerativeAI,
  originalImage: string,           // Base64
  translationResult: TranslationResult,
  config: ImageGenerationConfig
): Promise<ImageGenerationResult> {
  const model = genAI.getGenerativeModel({
    model: GEMINI_CONFIG.imageModel, // 'gemini-3-pro-image-preview'
  });

  const generationConfig = {
    responseModalities: ['TEXT', 'IMAGE'],
    imageOutputSettings: {
      aspectRatio: config.aspectRatio,
      resolution: config.resolution,
    },
  };

  const prompt = buildImageGenerationPrompt(translationResult);

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: originalImage } },
          { text: prompt },
        ],
      },
    ],
    generationConfig,
  });

  return parseImageGenerationResponse(result);
}
```

### 2.2 프롬프트 설계

```typescript
// src/services/imageGeneration.ts

function buildImageGenerationPrompt(translation: TranslationResult): string {
  return `You are an expert image editor specializing in product image localization.

TASK: Create a new version of this product image with the text translated to ${translation.targetLanguage}.

ORIGINAL TEXT DETECTED:
${translation.originalText}

TRANSLATED TEXT TO USE:
${translation.translatedText}

CRITICAL REQUIREMENTS:
1. MAINTAIN the exact same image layout, style, colors, and composition
2. REPLACE all visible text with the translated version above
3. PRESERVE brand names, logos, model numbers, and certifications unchanged
4. ENSURE text is clearly readable with appropriate:
   - Font size (similar to original)
   - Font color (high contrast with background)
   - Text positioning (same locations as original)
5. Keep the professional e-commerce quality

OUTPUT: Generate the modified product image with translated text.

IMPORTANT: Do not add, remove, or modify any visual elements other than the text replacement.`;
}
```

### 2.3 응답 파싱

```typescript
// src/services/imageGeneration.ts

interface ImageGenerationResult {
  success: boolean;
  generatedImage?: string;        // Base64
  mimeType?: string;
  error?: string;
  thinkingText?: string;          // Thinking Mode 출력 (디버깅용)
}

function parseImageGenerationResponse(result: GenerateContentResult): ImageGenerationResult {
  try {
    const response = result.response;
    const parts = response.candidates?.[0]?.content?.parts || [];

    let generatedImage: string | undefined;
    let mimeType: string | undefined;
    let thinkingText: string | undefined;

    for (const part of parts) {
      if (part.inlineData) {
        // 이미지 데이터
        generatedImage = part.inlineData.data;
        mimeType = part.inlineData.mimeType;
      } else if (part.text) {
        // Thinking Mode 텍스트 출력
        thinkingText = part.text;
      }
    }

    if (!generatedImage) {
      return {
        success: false,
        error: 'No image generated in response',
        thinkingText,
      };
    }

    return {
      success: true,
      generatedImage,
      mimeType: mimeType || 'image/png',
      thinkingText,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

---

## 3. 타입 정의

```typescript
// src/types/index.ts 추가

export interface ImageGenerationRequest {
  originalImage: string;          // Base64
  translationResult: TranslationResult;
  aspectRatio: AspectRatio;
  resolution: Resolution;
}

export interface ImageGenerationResult {
  success: boolean;
  generatedImage?: string;        // Base64
  mimeType?: string;
  error?: string;
  thinkingText?: string;
}

export type AspectRatio =
  | '1:1' | '2:3' | '3:2' | '3:4' | '4:3'
  | '4:5' | '5:4' | '9:16' | '16:9' | '21:9'
  | 'original';  // 원본 비율 유지

export type Resolution = '1K' | '2K' | '4K';

export interface ImageGenerationOptions {
  aspectRatio: AspectRatio;
  resolution: Resolution;
  autoGenerate: boolean;          // 번역 완료 후 자동 생성 여부
}
```

---

## 4. 컴포넌트 설계

### 4.1 디렉토리 구조

```
src/components/
├── ImageGenerator/
│   ├── index.ts                  # 배럴 export
│   ├── ImageGenerator.tsx        # 메인 컴포넌트
│   ├── GenerationOptions.tsx     # 해상도/비율 선택
│   ├── ImageComparison.tsx       # 원본/생성 이미지 비교
│   ├── GenerationProgress.tsx    # 생성 진행 상태
│   └── ImageDownload.tsx         # 다운로드 버튼
```

### 4.2 ImageGenerator 컴포넌트

```tsx
// src/components/ImageGenerator/ImageGenerator.tsx

import { useState } from 'react';
import { GenerationOptions } from './GenerationOptions';
import { ImageComparison } from './ImageComparison';
import { GenerationProgress } from './GenerationProgress';
import { Button } from '../common/Button';
import { useImageGeneration } from '../../hooks/useImageGeneration';
import type { TranslationResult, ImageGenerationOptions } from '../../types';

interface Props {
  originalImage: string;
  translationResult: TranslationResult;
}

export function ImageGenerator({ originalImage, translationResult }: Props) {
  const [options, setOptions] = useState<ImageGenerationOptions>({
    aspectRatio: 'original',
    resolution: '2K',
    autoGenerate: false,
  });

  const {
    isGenerating,
    generatedImage,
    error,
    progress,
    generate,
    reset,
  } = useImageGeneration();

  const handleGenerate = async () => {
    await generate(originalImage, translationResult, options);
  };

  return (
    <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
        번역 이미지 생성
      </h3>

      {/* 옵션 선택 */}
      <GenerationOptions
        options={options}
        onChange={setOptions}
        disabled={isGenerating}
      />

      {/* 생성 버튼 */}
      {!generatedImage && (
        <Button
          onClick={handleGenerate}
          loading={isGenerating}
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? '이미지 생성 중...' : '번역 이미지 생성'}
        </Button>
      )}

      {/* 진행 상태 */}
      {isGenerating && (
        <GenerationProgress progress={progress} />
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
          {error}
        </div>
      )}

      {/* 이미지 비교 */}
      {generatedImage && (
        <ImageComparison
          originalImage={originalImage}
          generatedImage={generatedImage}
          onReset={reset}
        />
      )}
    </div>
  );
}
```

### 4.3 GenerationOptions 컴포넌트

```tsx
// src/components/ImageGenerator/GenerationOptions.tsx

import type { ImageGenerationOptions, AspectRatio, Resolution } from '../../types';

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: 'original', label: '원본 유지' },
  { value: '1:1', label: '1:1 (정사각형)' },
  { value: '4:3', label: '4:3 (가로)' },
  { value: '3:4', label: '3:4 (세로)' },
  { value: '16:9', label: '16:9 (와이드)' },
  { value: '9:16', label: '9:16 (세로 와이드)' },
];

const RESOLUTIONS: { value: Resolution; label: string; description: string }[] = [
  { value: '1K', label: '1K', description: '빠른 생성' },
  { value: '2K', label: '2K', description: '권장' },
  { value: '4K', label: '4K', description: '고화질' },
];

interface Props {
  options: ImageGenerationOptions;
  onChange: (options: ImageGenerationOptions) => void;
  disabled?: boolean;
}

export function GenerationOptions({ options, onChange, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 비율 선택 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          이미지 비율
        </label>
        <select
          value={options.aspectRatio}
          onChange={(e) => onChange({ ...options, aspectRatio: e.target.value as AspectRatio })}
          disabled={disabled}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                     bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
        >
          {ASPECT_RATIOS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* 해상도 선택 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          해상도
        </label>
        <div className="flex gap-2">
          {RESOLUTIONS.map(({ value, label, description }) => (
            <button
              key={value}
              onClick={() => onChange({ ...options, resolution: value })}
              disabled={disabled}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors
                ${options.resolution === value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              title={description}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 4.4 ImageComparison 컴포넌트

```tsx
// src/components/ImageGenerator/ImageComparison.tsx

import { useState } from 'react';
import { Button } from '../common/Button';

interface Props {
  originalImage: string;
  generatedImage: string;
  onReset: () => void;
}

export function ImageComparison({ originalImage, generatedImage, onReset }: Props) {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'overlay'>('side-by-side');

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${generatedImage}`;
    link.download = `translated_image_${Date.now()}.png`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* 뷰 모드 토글 */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('side-by-side')}
          className={`px-3 py-1 rounded text-sm ${
            viewMode === 'side-by-side'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          나란히 보기
        </button>
        <button
          onClick={() => setViewMode('overlay')}
          className={`px-3 py-1 rounded text-sm ${
            viewMode === 'overlay'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          오버레이
        </button>
      </div>

      {/* 이미지 비교 영역 */}
      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">원본</p>
            <img
              src={`data:image/jpeg;base64,${originalImage}`}
              alt="Original"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700"
            />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">번역 이미지</p>
            <img
              src={`data:image/png;base64,${generatedImage}`}
              alt="Generated"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>
      ) : (
        <div className="relative">
          {/* Overlay implementation with slider */}
          <img
            src={`data:image/png;base64,${generatedImage}`}
            alt="Generated"
            className="w-full rounded-lg"
          />
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        <Button onClick={handleDownload} className="flex-1">
          다운로드
        </Button>
        <Button variant="secondary" onClick={onReset}>
          다시 생성
        </Button>
      </div>
    </div>
  );
}
```

---

## 5. Hook 설계

```typescript
// src/hooks/useImageGeneration.ts

import { useState, useCallback } from 'react';
import { generateTranslatedImage } from '../services/imageGeneration';
import { useAppStore } from '../stores/useAppStore';
import type { TranslationResult, ImageGenerationOptions, ImageGenerationResult } from '../types';

interface UseImageGenerationReturn {
  isGenerating: boolean;
  generatedImage: string | null;
  error: string | null;
  progress: number;
  generate: (
    originalImage: string,
    translationResult: TranslationResult,
    options: ImageGenerationOptions
  ) => Promise<void>;
  reset: () => void;
}

export function useImageGeneration(): UseImageGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const generate = useCallback(async (
    originalImage: string,
    translationResult: TranslationResult,
    options: ImageGenerationOptions
  ) => {
    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setGeneratedImage(null);

    try {
      // 프로그레스 시뮬레이션 (실제로는 스트리밍 응답에서 업데이트)
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const result = await generateTranslatedImage(
        originalImage,
        translationResult,
        {
          aspectRatio: options.aspectRatio === 'original' ? '1:1' : options.aspectRatio,
          resolution: options.resolution,
        }
      );

      clearInterval(progressInterval);

      if (result.success && result.generatedImage) {
        setGeneratedImage(result.generatedImage);
        setProgress(100);
      } else {
        setError(result.error || '이미지 생성에 실패했습니다.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setGeneratedImage(null);
    setError(null);
    setProgress(0);
  }, []);

  return {
    isGenerating,
    generatedImage,
    error,
    progress,
    generate,
    reset,
  };
}
```

---

## 6. Store 업데이트

```typescript
// src/stores/useAppStore.ts 확장

interface AppState {
  // ... 기존 상태

  // 이미지 생성 관련
  imageGenerationEnabled: boolean;
  defaultResolution: Resolution;
  defaultAspectRatio: AspectRatio;

  // Actions
  setImageGenerationEnabled: (enabled: boolean) => void;
  setDefaultResolution: (resolution: Resolution) => void;
  setDefaultAspectRatio: (aspectRatio: AspectRatio) => void;
}
```

---

## 7. UI 통합 (TranslationResult 컴포넌트)

```tsx
// src/components/TranslationResult.tsx 수정

import { ImageGenerator } from './ImageGenerator';

// 기존 TranslationResult 컴포넌트에 추가
{translationResult && (
  <div className="space-y-6">
    {/* 기존 번역 결과 표시 */}
    <div>
      <h3>번역 결과</h3>
      <p>{translationResult.translatedText}</p>
    </div>

    {/* Phase 2: 이미지 생성 섹션 */}
    <ImageGenerator
      originalImage={selectedImage.base64}
      translationResult={translationResult}
    />
  </div>
)}
```

---

## 8. 에러 처리

### 8.1 에러 케이스

| 에러 코드 | 원인 | 처리 |
|----------|------|------|
| `RATE_LIMIT` | API 호출 제한 초과 | 재시도 안내 |
| `INVALID_IMAGE` | 지원되지 않는 이미지 형식 | 형식 안내 |
| `CONTENT_FILTER` | 콘텐츠 필터링 | 다른 이미지 시도 안내 |
| `TIMEOUT` | 생성 시간 초과 | 재시도 또는 해상도 낮춤 안내 |

### 8.2 에러 메시지 맵핑

```typescript
// src/utils/errors.ts

export const IMAGE_GEN_ERRORS: Record<string, string> = {
  'RATE_LIMIT': '일시적으로 요청이 많습니다. 잠시 후 다시 시도해주세요.',
  'INVALID_IMAGE': '이미지 형식이 지원되지 않습니다. JPG, PNG, WebP를 사용해주세요.',
  'CONTENT_FILTER': '이미지 내용이 정책에 맞지 않습니다. 다른 이미지를 시도해주세요.',
  'TIMEOUT': '이미지 생성 시간이 초과되었습니다. 해상도를 낮추거나 다시 시도해주세요.',
  'UNKNOWN': '알 수 없는 오류가 발생했습니다. 다시 시도해주세요.',
};
```

---

## 9. 구현 체크리스트

### 9.1 서비스 레이어
- [ ] `imageGeneration.ts` 서비스 생성
- [ ] Gemini API 이미지 생성 연동
- [ ] 응답 파싱 로직
- [ ] 에러 핸들링

### 9.2 타입 정의
- [ ] `ImageGenerationRequest` 타입
- [ ] `ImageGenerationResult` 타입
- [ ] `AspectRatio`, `Resolution` 타입

### 9.3 컴포넌트
- [ ] `ImageGenerator` 메인 컴포넌트
- [ ] `GenerationOptions` 옵션 선택
- [ ] `ImageComparison` 이미지 비교
- [ ] `GenerationProgress` 진행 상태

### 9.4 Hook
- [ ] `useImageGeneration` 커스텀 훅

### 9.5 통합
- [ ] `TranslationResult`에 이미지 생성 섹션 추가
- [ ] Store 상태 추가

### 9.6 테스트
- [ ] 단위 테스트 작성
- [ ] 통합 테스트

---

## 10. 예상 이슈 및 해결 방안

| 이슈 | 해결 방안 |
|------|----------|
| 이미지 생성 시간이 오래 걸림 | 프로그레스 바로 UX 개선, 타임아웃 설정 |
| 텍스트 위치가 잘못됨 | 프롬프트 개선, 위치 힌트 추가 |
| 폰트 스타일 불일치 | 프롬프트에 폰트 스타일 명시 |
| API 비용 | 해상도 기본값을 2K로 설정, 4K는 고급 옵션 |

---

## 11. 참고 자료

- [Gemini API Image Generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [Nano Banana Pro Documentation](https://ai.google.dev/gemini-api/docs/nanobanana)
- [Thinking Mode Details](https://ai.google.dev/gemini-api/docs/thinking-mode)

---

*문서 버전: 1.0.0*
*최종 수정: 2026-01-20*
