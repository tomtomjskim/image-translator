import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GenerateContentResult } from '@google/generative-ai';
import type { TranslationResult, ImageGenerationResult, ImageGenerationConfig } from '../types';
import { GEMINI_CONFIG } from '../utils/constants';

let genAI: GoogleGenerativeAI | null = null;

// Gemini 클라이언트 설정 (gemini.ts와 공유)
export function setGenAIInstance(instance: GoogleGenerativeAI): void {
  genAI = instance;
}

// 이미지 생성 프롬프트 빌드
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

// 응답 파싱
function parseImageGenerationResponse(result: GenerateContentResult): ImageGenerationResult {
  try {
    const response = result.response;
    const candidates = response.candidates;

    if (!candidates || candidates.length === 0) {
      return {
        success: false,
        error: 'No candidates in response',
      };
    }

    const parts = candidates[0]?.content?.parts || [];

    let generatedImage: string | undefined;
    let mimeType: string | undefined;
    let thinkingText: string | undefined;

    for (const part of parts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyPart = part as any;
      if (anyPart.inlineData) {
        // 이미지 데이터
        generatedImage = anyPart.inlineData.data;
        mimeType = anyPart.inlineData.mimeType;
      } else if (anyPart.text) {
        // Thinking Mode 텍스트 출력
        thinkingText = anyPart.text;
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
      error: error instanceof Error ? error.message : 'Unknown error parsing response',
    };
  }
}

// 번역된 이미지 생성
export async function generateTranslatedImage(
  originalImage: string,           // Base64
  translationResult: TranslationResult,
  config: ImageGenerationConfig
): Promise<ImageGenerationResult> {
  if (!genAI) {
    return {
      success: false,
      error: 'Gemini API not initialized. Please set your API key.',
    };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: GEMINI_CONFIG.imageModel, // 'gemini-3-pro-image-preview'
    });

    const prompt = buildImageGenerationPrompt(translationResult);

    // originalImage가 data URL인 경우 base64 부분만 추출
    let imageBase64 = originalImage;
    if (originalImage.startsWith('data:')) {
      imageBase64 = originalImage.split(',')[1] || originalImage;
    }

    // Gemini API 호출 - 이미지 생성 모델 사용
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (model as any).generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageOutputSettings: {
          aspectRatio: config.aspectRatio,
          resolution: config.resolution,
        },
      },
    });

    return parseImageGenerationResponse(result as GenerateContentResult);
  } catch (error) {
    // 에러 타입에 따른 메시지 매핑
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return {
        success: false,
        error: '일시적으로 요청이 많습니다. 잠시 후 다시 시도해주세요.',
      };
    }

    if (errorMessage.includes('invalid image') || errorMessage.includes('400')) {
      return {
        success: false,
        error: '이미지 형식이 지원되지 않습니다. JPG, PNG, WebP를 사용해주세요.',
      };
    }

    if (errorMessage.includes('content filter') || errorMessage.includes('SAFETY')) {
      return {
        success: false,
        error: '이미지 내용이 정책에 맞지 않습니다. 다른 이미지를 시도해주세요.',
      };
    }

    if (errorMessage.includes('timeout') || errorMessage.includes('DEADLINE_EXCEEDED')) {
      return {
        success: false,
        error: '이미지 생성 시간이 초과되었습니다. 해상도를 낮추거나 다시 시도해주세요.',
      };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// 원본 이미지 비율 계산
export function calculateAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  const w = width / divisor;
  const h = height / divisor;

  // 일반적인 비율로 매핑
  const ratio = width / height;

  if (Math.abs(ratio - 1) < 0.1) return '1:1';
  if (Math.abs(ratio - 4/3) < 0.1) return '4:3';
  if (Math.abs(ratio - 3/4) < 0.1) return '3:4';
  if (Math.abs(ratio - 16/9) < 0.1) return '16:9';
  if (Math.abs(ratio - 9/16) < 0.1) return '9:16';
  if (Math.abs(ratio - 3/2) < 0.1) return '3:2';
  if (Math.abs(ratio - 2/3) < 0.1) return '2:3';
  if (Math.abs(ratio - 4/5) < 0.1) return '4:5';
  if (Math.abs(ratio - 5/4) < 0.1) return '5:4';
  if (Math.abs(ratio - 21/9) < 0.1) return '21:9';

  // 정확한 매칭이 없으면 가장 가까운 비율 반환
  return `${w}:${h}`;
}
