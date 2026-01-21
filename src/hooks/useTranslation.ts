import { useCallback } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { processImage } from '../services/gemini';
import { saveTranslation } from '../services/db/operations';
import type { ImageItem } from '../types';

export function useTranslation() {
  const { images, updateImage, settings, setIsProcessing, autoSaveHistory } = useAppStore();

  // 단일 이미지 번역
  const translateSingleImage = useCallback(
    async (item: ImageItem) => {
      updateImage(item.id, { status: 'processing' });

      try {
        const image = item.file || item.url;
        if (!image) {
          throw new Error('No image source');
        }

        const result = await processImage(
          item.id,
          image,
          item.preview,
          settings.targetLanguage,
          settings.translationTone
        );

        updateImage(item.id, {
          status: 'completed',
          result,
        });

        // 자동 저장 (히스토리)
        if (autoSaveHistory) {
          try {
            await saveTranslation(item.preview, result);
          } catch (saveError) {
            console.error('Failed to save to history:', saveError);
            // 저장 실패는 무시 (번역은 성공했으므로)
          }
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Translation failed';
        updateImage(item.id, {
          status: 'error',
          error: errorMessage,
        });
        throw error;
      }
    },
    [updateImage, settings, autoSaveHistory]
  );

  // 모든 이미지 번역
  const translateAllImages = useCallback(async () => {
    const pendingImages = images.filter((img) => img.status === 'pending');

    if (pendingImages.length === 0) return;

    setIsProcessing(true);

    try {
      // 순차적으로 처리 (API 제한 고려)
      for (const item of pendingImages) {
        try {
          await translateSingleImage(item);
        } catch (error) {
          console.error(`Failed to translate image ${item.id}:`, error);
          // 개별 실패는 무시하고 계속 진행
        }
      }
    } finally {
      setIsProcessing(false);
    }
  }, [images, translateSingleImage, setIsProcessing]);

  // 특정 이미지 재번역
  const retryTranslation = useCallback(
    async (id: string) => {
      const item = images.find((img) => img.id === id);
      if (!item) return;

      updateImage(id, { status: 'pending', error: undefined });
      await translateSingleImage(item);
    },
    [images, updateImage, translateSingleImage]
  );

  return {
    translateAllImages,
    translateSingleImage,
    retryTranslation,
  };
}
