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
    mimeType,
    error,
    progress,
    generate,
    reset,
  } = useImageGeneration();

  const handleGenerate = async () => {
    await generate(originalImage, translationResult, options);
  };

  return (
    <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          번역 이미지 생성
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
          Nano Banana Pro
        </span>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        원본 이미지의 텍스트를 번역된 텍스트로 교체한 새 이미지를 생성합니다.
      </p>

      {/* 옵션 선택 */}
      {!generatedImage && (
        <GenerationOptions
          options={options}
          onChange={setOptions}
          disabled={isGenerating}
        />
      )}

      {/* 생성 버튼 */}
      {!generatedImage && !isGenerating && (
        <Button
          onClick={handleGenerate}
          loading={isGenerating}
          disabled={isGenerating}
          className="w-full"
        >
          번역 이미지 생성
        </Button>
      )}

      {/* 진행 상태 */}
      {isGenerating && (
        <GenerationProgress progress={progress} />
      )}

      {/* 에러 표시 */}
      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">이미지 생성 실패</p>
              <p>{error}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="mt-2 w-full"
          >
            다시 시도
          </Button>
        </div>
      )}

      {/* 이미지 비교 */}
      {generatedImage && mimeType && (
        <ImageComparison
          originalImage={originalImage}
          generatedImage={generatedImage}
          mimeType={mimeType}
          onReset={reset}
        />
      )}
    </div>
  );
}
