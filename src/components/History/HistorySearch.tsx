import { useState, useEffect } from 'react';
import type { HistoryFilters } from '../../services/db/schema';

interface Props {
  filters: HistoryFilters;
  onChange: (filters: HistoryFilters) => void;
}

export function HistorySearch({ filters, onChange }: Props) {
  const [searchInput, setSearchInput] = useState(filters.searchQuery);

  // 디바운스 검색
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.searchQuery) {
        onChange({ ...filters, searchQuery: searchInput });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters, onChange]);

  return (
    <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
      {/* 검색 입력 */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="원문 또는 번역문 검색..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                     bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        {searchInput && (
          <button
            onClick={() => {
              setSearchInput('');
              onChange({ ...filters, searchQuery: '' });
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* 필터 버튼들 */}
      <div className="flex gap-2 flex-wrap">
        {/* 즐겨찾기 필터 */}
        <button
          onClick={() => onChange({ ...filters, favoritesOnly: !filters.favoritesOnly })}
          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
            filters.favoritesOnly
              ? 'bg-yellow-100 border-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-yellow-400'
              : 'bg-slate-100 border-slate-300 text-slate-600 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300 hover:border-yellow-300'
          }`}
        >
          <span className="mr-1">{filters.favoritesOnly ? '★' : '☆'}</span>
          즐겨찾기
        </button>

        {/* 필터 초기화 */}
        {(filters.searchQuery || filters.favoritesOnly || filters.sourceLanguage || filters.targetLanguage) && (
          <button
            onClick={() => {
              setSearchInput('');
              onChange({
                searchQuery: '',
                sourceLanguage: '',
                targetLanguage: '',
                favoritesOnly: false,
              });
            }}
            className="px-3 py-1 text-xs rounded-full border border-slate-300 dark:border-slate-600
                       text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            필터 초기화
          </button>
        )}
      </div>
    </div>
  );
}
