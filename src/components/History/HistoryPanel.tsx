import { useEffect } from 'react';
import { HistorySearch } from './HistorySearch';
import { HistoryList } from './HistoryList';
import { HistoryExport } from './HistoryExport';
import { useHistory } from '../../hooks/useHistory';
import type { TranslationRecord } from '../../services/db/schema';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (record: TranslationRecord) => void;
}

export function HistoryPanel({ isOpen, onClose, onSelect }: Props) {
  const {
    records,
    total,
    isLoading,
    filters,
    setFilters,
    loadMore,
    hasMore,
    deleteRecord,
    toggleFavorite,
    refresh,
  } = useHistory();

  // 패널 열릴 때 새로고침
  useEffect(() => {
    if (isOpen) {
      refresh();
    }
  }, [isOpen, refresh]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDelete = async (id: string) => {
    if (window.confirm('이 번역 기록을 삭제하시겠습니까?')) {
      await deleteRecord(id);
    }
  };

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* 사이드 패널 */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-800 shadow-xl z-50 flex flex-col transform transition-transform">
        {/* 헤더 */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              번역 히스토리
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              총 {total}건의 번역 기록
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="닫기"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 검색/필터 */}
        <HistorySearch filters={filters} onChange={setFilters} />

        {/* 목록 */}
        <div className="flex-1 overflow-hidden">
          <HistoryList
            records={records}
            isLoading={isLoading}
            onSelect={onSelect}
            onDelete={handleDelete}
            onToggleFavorite={toggleFavorite}
            onLoadMore={loadMore}
            hasMore={hasMore}
          />
        </div>

        {/* 하단 */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300
                       hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors
                       disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            새로고침
          </button>
          <HistoryExport />
        </div>
      </div>
    </>
  );
}
