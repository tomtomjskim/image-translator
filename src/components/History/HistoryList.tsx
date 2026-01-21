import { useRef, useEffect } from 'react';
import { HistoryItem } from './HistoryItem';
import type { TranslationRecord } from '../../services/db/schema';

interface Props {
  records: TranslationRecord[];
  isLoading: boolean;
  onSelect: (record: TranslationRecord) => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
}

export function HistoryList({
  records,
  isLoading,
  onSelect,
  onDelete,
  onToggleFavorite,
  onLoadMore,
  hasMore,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // 무한 스크롤
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // 하단 100px 이내에 도달하면 더 로드
      if (scrollTop + clientHeight >= scrollHeight - 100 && hasMore && !isLoading) {
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoading, onLoadMore]);

  if (!isLoading && records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <svg
          className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          번역 히스토리가 없습니다.
        </p>
        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
          이미지를 번역하면 여기에 기록됩니다.
        </p>
      </div>
    );
  }

  return (
    <div ref={listRef} className="overflow-y-auto h-full">
      {records.map((record) => (
        <HistoryItem
          key={record.id}
          record={record}
          onSelect={() => onSelect(record)}
          onDelete={() => onDelete(record.id)}
          onToggleFavorite={() => onToggleFavorite(record.id)}
        />
      ))}

      {/* 로딩 인디케이터 */}
      {isLoading && (
        <div className="flex justify-center py-4">
          <svg
            className="animate-spin w-6 h-6 text-blue-600"
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
        </div>
      )}

      {/* 더 불러오기 버튼 (선택적) */}
      {!isLoading && hasMore && (
        <div className="p-4 text-center">
          <button
            onClick={onLoadMore}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            더 보기
          </button>
        </div>
      )}
    </div>
  );
}
