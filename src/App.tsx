import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { LanguageSelector } from './components/LanguageSelector';
import { ImagePreview } from './components/ImagePreview';
import { TranslationResult } from './components/TranslationResult';
import { Button } from './components/common/Button';
import { useAppStore } from './stores/useAppStore';
import { useTranslation } from './hooks/useTranslation';
import { useApiKey } from './hooks/useApiKey';

function App() {
  const { images, clearImages, isProcessing, hasApiKey } = useAppStore();
  const { translateAllImages, retryTranslation } = useTranslation();
  const { isLoading } = useApiKey();

  const pendingCount = images.filter((img) => img.status === 'pending').length;
  const completedImages = images.filter((img) => img.status === 'completed');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg
            className="animate-spin h-10 w-10 mx-auto text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="mt-3 text-slate-600 dark:text-slate-400">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* API Key Warning */}
        {!hasApiKey && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h3 className="font-medium text-amber-800 dark:text-amber-200">
                  API Key가 필요합니다
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  이미지 번역을 사용하려면 먼저 Gemini API Key를 설정해주세요.
                  오른쪽 상단의 "API Key 필요" 버튼을 클릭하여 설정할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Language Settings */}
        <LanguageSelector />

        {/* Upload Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
            이미지 업로드
          </h2>
          <ImageUploader />
        </div>

        {/* Image List */}
        {images.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                업로드된 이미지 ({images.length})
              </h2>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={clearImages}>
                  전체 삭제
                </Button>
                {pendingCount > 0 && (
                  <Button
                    onClick={translateAllImages}
                    loading={isProcessing}
                    disabled={!hasApiKey}
                  >
                    {isProcessing
                      ? '번역 중...'
                      : `${pendingCount}개 이미지 번역`}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((item) => (
                <ImagePreview
                  key={item.id}
                  item={item}
                  onRetry={retryTranslation}
                />
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {completedImages.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              번역 결과 ({completedImages.length})
            </h2>
            {completedImages.map((item) => (
              <TranslationResult key={item.id} item={item} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {images.length === 0 && (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-16 w-16 text-slate-300 dark:text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-slate-600 dark:text-slate-400">
              이미지를 업로드해주세요
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-500">
              상품 이미지를 업로드하면 텍스트를 추출하고 번역해 드립니다
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          <p>Image Translator - Gemini AI 기반 이미지 OCR 및 번역 서비스</p>
          <p className="mt-1">
            API 키는 브라우저에 암호화되어 저장되며 외부로 전송되지 않습니다.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
