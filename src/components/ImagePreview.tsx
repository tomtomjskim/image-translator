import { useAppStore } from '../stores/useAppStore';
import type { ImageItem } from '../types';

interface ImagePreviewProps {
  item: ImageItem;
  onRetry?: (id: string) => void;
}

export function ImagePreview({ item, onRetry }: ImagePreviewProps) {
  const { removeImage } = useAppStore();

  const statusColors = {
    pending: 'bg-slate-100 dark:bg-slate-700',
    processing: 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700',
    completed: 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700',
  };

  return (
    <div
      className={`relative rounded-xl border overflow-hidden transition-all ${statusColors[item.status]}`}
    >
      {/* Image */}
      <div className="aspect-video relative bg-slate-200 dark:bg-slate-700">
        <img
          src={item.preview}
          alt="Preview"
          className="absolute inset-0 w-full h-full object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23999"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
          }}
        />

        {/* Processing Overlay */}
        {item.status === 'processing' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-center text-white">
              <svg
                className="animate-spin h-8 w-8 mx-auto mb-2"
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
              <span className="text-sm">번역 중...</span>
            </div>
          </div>
        )}

        {/* Remove Button */}
        <button
          onClick={() => removeImage(item.id)}
          className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Status Badge */}
        <div className="absolute bottom-2 left-2">
          {item.status === 'completed' && (
            <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
              완료
            </span>
          )}
          {item.status === 'error' && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
              오류
            </span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {item.status === 'error' && item.error && (
        <div className="p-3 border-t border-red-200 dark:border-red-800">
          <p className="text-xs text-red-600 dark:text-red-400 mb-2">{item.error}</p>
          {onRetry && (
            <button
              onClick={() => onRetry(item.id)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              다시 시도
            </button>
          )}
        </div>
      )}
    </div>
  );
}
