import type { TranslationRecord } from '../../services/db/schema';

interface Props {
  record: TranslationRecord;
  onSelect: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

export function HistoryItem({ record, onSelect, onDelete, onToggleFavorite }: Props) {
  return (
    <div
      className="p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors"
      onClick={onSelect}
    >
      <div className="flex gap-3">
        {/* 썸네일 */}
        <img
          src={`data:image/jpeg;base64,${record.image.thumbnail}`}
          alt="Thumbnail"
          className="w-16 h-16 object-cover rounded-lg flex-shrink-0 bg-slate-200 dark:bg-slate-700"
        />

        {/* 내용 */}
        <div className="flex-1 min-w-0">
          {/* 날짜 & 언어 */}
          <div className="flex justify-between items-start mb-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {new Date(record.createdAt).toLocaleDateString('ko-KR')}
            </span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-600 rounded text-slate-600 dark:text-slate-300">
              {record.sourceLanguage} → {record.targetLanguage}
            </span>
          </div>

          {/* 원문 (truncated) */}
          <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
            {record.originalText}
          </p>

          {/* 번역문 (truncated) */}
          <p className="text-sm text-slate-800 dark:text-slate-200 truncate font-medium">
            {record.translatedText}
          </p>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-end gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onToggleFavorite}
          className={`p-1.5 rounded transition-colors ${
            record.isFavorite
              ? 'text-yellow-500'
              : 'text-slate-400 hover:text-yellow-500'
          }`}
          title={record.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
        >
          <svg
            className="w-4 h-4"
            fill={record.isFavorite ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
            />
          </svg>
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded text-slate-400 hover:text-red-500 transition-colors"
          title="삭제"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
