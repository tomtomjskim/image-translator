import { useState, useCallback } from 'react';
import { generateTranslatedImage } from '../services/imageGeneration';
import type { TranslationResult, ImageGenerationOptions, ImageGenerationResult, AspectRatio } from '../types';

interface UseImageGenerationReturn {
  isGenerating: boolean;
  generatedImage: string | null;
  mimeType: string | null;
  error: string | null;
  progress: number;
  thinkingText: string | null;
  generate: (
    originalImage: string,
    translationResult: TranslationResult,
    options: ImageGenerationOptions
  ) => Promise<ImageGenerationResult>;
  reset: () => void;
}

export function useImageGeneration(): UseImageGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [thinkingText, setThinkingText] = useState<string | null>(null);

  const generate = useCallback(async (
    originalImage: string,
    translationResult: TranslationResult,
    options: ImageGenerationOptions
  ): Promise<ImageGenerationResult> => {
    setIsGenerating(true);
    setError(null);
    setProgress(0);
    setGeneratedImage(null);
    setMimeType(null);
    setThinkingText(null);

    // 프로그레스 시뮬레이션 (실제 API는 스트리밍을 지원하지 않음)
    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 5, 90));
    }, 800);

    try {
      // 'original' 비율은 API에서 지원하지 않으므로 기본값 '1:1'로 대체
      const aspectRatio: Exclude<AspectRatio, 'original'> =
        options.aspectRatio === 'original' ? '1:1' : options.aspectRatio;

      const result = await generateTranslatedImage(
        originalImage,
        translationResult,
        {
          aspectRatio,
          resolution: options.resolution,
        }
      );

      clearInterval(progressInterval);

      if (result.success && result.generatedImage) {
        setGeneratedImage(result.generatedImage);
        setMimeType(result.mimeType || 'image/png');
        setThinkingText(result.thinkingText || null);
        setProgress(100);
      } else {
        setError(result.error || '이미지 생성에 실패했습니다.');
        setThinkingText(result.thinkingText || null);
      }

      return result;
    } catch (err) {
      clearInterval(progressInterval);
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setGeneratedImage(null);
    setMimeType(null);
    setError(null);
    setProgress(0);
    setThinkingText(null);
  }, []);

  return {
    isGenerating,
    generatedImage,
    mimeType,
    error,
    progress,
    thinkingText,
    generate,
    reset,
  };
}
