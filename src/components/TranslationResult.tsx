import { useState } from 'react';
import type { ImageItem } from '../types';
import { Button } from './common/Button';
import { ImageGenerator } from './ImageGenerator';

interface TranslationResultProps {
  item: ImageItem;
}

export function TranslationResult({ item }: TranslationResultProps) {
  const [copied, setCopied] = useState<'original' | 'translated' | null>(null);

  if (!item.result) return null;

  const { result } = item;

  const handleCopy = async (text: string, type: 'original' | 'translated') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleExportJson = () => {
    const data = {
      imageUrl: result.imageUrl,
      detectedLanguage: result.detectedLanguage,
      targetLanguage: result.targetLanguage,
      originalText: result.originalText,
      translatedText: result.translatedText,
      confidence: result.confidence,
      timestamp: new Date(result.timestamp).toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translation-${result.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="grid md:grid-cols-2 gap-0">
        {/* Image */}
        <div className="bg-slate-100 dark:bg-slate-900">
          <img
            src={item.preview}
            alt="Translated"
            className="w-full h-full object-contain max-h-[300px]"
          />
        </div>

        {/* Translation Info */}
        <div className="p-4 space-y-4">
          {/* Meta Info */}
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">
              {result.detectedLanguage}
            </span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
              {result.targetLanguage}
            </span>
            <span
              className={`ml-auto px-2 py-0.5 rounded ${
                result.confidence === 'high'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : result.confidence === 'medium'
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}
            >
              {result.confidence === 'high' ? '높음' : result.confidence === 'medium' ? '보통' : '낮음'}
            </span>
          </div>

          {/* Original Text */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                원문
              </label>
              <button
                onClick={() => handleCopy(result.originalText, 'original')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {copied === 'original' ? '복사됨!' : '복사'}
              </button>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-[100px] overflow-y-auto">
              {result.originalText}
            </div>
          </div>

          {/* Translated Text */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                번역
              </label>
              <button
                onClick={() => handleCopy(result.translatedText, 'translated')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                {copied === 'translated' ? '복사됨!' : '복사'}
              </button>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap max-h-[100px] overflow-y-auto">
              {result.translatedText}
            </div>
          </div>

          {/* Export Button */}
          <div className="pt-2">
            <Button variant="ghost" size="sm" onClick={handleExportJson}>
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              JSON 내보내기
            </Button>
          </div>
        </div>
      </div>

      {/* Phase 2: 이미지 생성 섹션 */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <ImageGenerator
          originalImage={item.preview}
          translationResult={result}
        />
      </div>
    </div>
  );
}
