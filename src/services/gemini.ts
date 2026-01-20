import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GeminiOCRResponse, TranslationResult } from '../types';
import { GEMINI_CONFIG } from '../utils/constants';

let genAI: GoogleGenerativeAI | null = null;

// Gemini 클라이언트 초기화
export function initGemini(apiKey: string): void {
  genAI = new GoogleGenerativeAI(apiKey);
}

// 이미지를 Base64로 변환
export async function imageToBase64(image: File | string): Promise<{ data: string; mimeType: string }> {
  if (typeof image === 'string') {
    // URL인 경우 fetch로 가져오기
    const response = await fetch(image);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    return {
      data: base64,
      mimeType: blob.type || 'image/jpeg',
    };
  }

  // File인 경우
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({
        data: base64,
        mimeType: image.type,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(image);
  });
}

// OCR + 번역 프롬프트 생성
function createOCRPrompt(targetLanguage: string, tone: string): string {
  const toneInstruction = {
    general: 'Use natural, fluent language.',
    product: 'Optimize for e-commerce product descriptions. Make it appealing and professional.',
    formal: 'Use formal, professional tone.',
  }[tone] || 'Use natural, fluent language.';

  return `You are an expert OCR and translation assistant specialized in product descriptions.

Task:
1. Extract ALL text from the provided image accurately, including any text on products, labels, packaging, or backgrounds
2. Detect the source language automatically
3. Translate the extracted text to ${targetLanguage}
4. ${toneInstruction}

Rules:
- Preserve formatting (line breaks, bullet points) where appropriate
- Keep brand names, model numbers, and proper nouns unchanged
- If text is unclear or partially visible, indicate with [unclear]
- If no text is found in the image, set original_text to "[No text detected]"

IMPORTANT: You MUST respond with ONLY a valid JSON object in the following format, no additional text:
{
  "detected_language": "the detected source language name in English",
  "original_text": "the extracted original text",
  "translated_text": "the translated text in ${targetLanguage}",
  "confidence": "high" or "medium" or "low"
}`;
}

// OCR + 번역 실행
export async function translateImage(
  image: File | string,
  targetLanguage: string,
  tone: string = 'general'
): Promise<GeminiOCRResponse> {
  if (!genAI) {
    throw new Error('Gemini API not initialized. Please set your API key.');
  }

  const model = genAI.getGenerativeModel({ model: GEMINI_CONFIG.ocrModel });
  const imageData = await imageToBase64(image);

  const prompt = createOCRPrompt(targetLanguage, tone);

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.data,
      },
    },
  ]);

  const response = await result.response;
  const text = response.text();

  // JSON 파싱
  try {
    // JSON 블록 추출 (```json ... ``` 형식 처리)
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                      text.match(/```\s*([\s\S]*?)\s*```/) ||
                      [null, text];
    const jsonStr = jsonMatch[1] || text;

    // JSON 파싱
    const parsed = JSON.parse(jsonStr.trim());

    return {
      detected_language: parsed.detected_language || 'Unknown',
      original_text: parsed.original_text || '',
      translated_text: parsed.translated_text || '',
      confidence: parsed.confidence || 'medium',
    };
  } catch {
    // JSON 파싱 실패 시 원본 텍스트 반환
    return {
      detected_language: 'Unknown',
      original_text: text,
      translated_text: text,
      confidence: 'low',
    };
  }
}

// 전체 번역 프로세스
export async function processImage(
  id: string,
  image: File | string,
  imageUrl: string,
  targetLanguage: string,
  tone: string
): Promise<TranslationResult> {
  const response = await translateImage(image, targetLanguage, tone);

  return {
    id,
    imageUrl,
    originalText: response.original_text,
    translatedText: response.translated_text,
    detectedLanguage: response.detected_language,
    targetLanguage,
    confidence: response.confidence,
    timestamp: Date.now(),
  };
}
