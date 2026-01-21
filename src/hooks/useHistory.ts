import { useState, useEffect, useCallback } from 'react';
import {
  getTranslations,
  deleteTranslation,
  toggleFavorite as toggleFavoriteDB,
  getStatistics,
} from '../services/db/operations';
import type { TranslationRecord, HistoryFilters, HistoryStatistics } from '../services/db/schema';

interface UseHistoryReturn {
  records: TranslationRecord[];
  total: number;
  isLoading: boolean;
  filters: HistoryFilters;
  setFilters: (filters: HistoryFilters) => void;
  loadMore: () => void;
  hasMore: boolean;
  deleteRecord: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  statistics: HistoryStatistics | null;
  loadStatistics: () => Promise<void>;
}

const defaultFilters: HistoryFilters = {
  searchQuery: '',
  sourceLanguage: '',
  targetLanguage: '',
  favoritesOnly: false,
};

export function useHistory(): UseHistoryReturn {
  const [records, setRecords] = useState<TranslationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFiltersState] = useState<HistoryFilters>(defaultFilters);
  const [statistics, setStatistics] = useState<HistoryStatistics | null>(null);

  const loadRecords = useCallback(async (reset = false) => {
    setIsLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      const { records: newRecords, total: newTotal } = await getTranslations({
        page: currentPage,
        limit: 20,
        searchQuery: filters.searchQuery || undefined,
        sourceLanguage: filters.sourceLanguage || undefined,
        targetLanguage: filters.targetLanguage || undefined,
        favoritesOnly: filters.favoritesOnly,
      });

      if (reset) {
        setRecords(newRecords);
        setPage(1);
      } else {
        setRecords((prev) => [...prev, ...newRecords]);
      }
      setTotal(newTotal);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, filters]);

  // 필터 변경 시 리셋 및 다시 로드
  const setFilters = useCallback((newFilters: HistoryFilters) => {
    setFiltersState(newFilters);
    setPage(1);
  }, []);

  // 초기 로드 및 필터 변경 시
  useEffect(() => {
    loadRecords(true);
  }, [filters]);

  // 페이지 변경 시 추가 로드
  useEffect(() => {
    if (page > 1) {
      loadRecords(false);
    }
  }, [page]);

  const loadMore = useCallback(() => {
    if (!isLoading && records.length < total) {
      setPage((p) => p + 1);
    }
  }, [isLoading, records.length, total]);

  const deleteRecord = useCallback(async (id: string) => {
    try {
      await deleteTranslation(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
    } catch (error) {
      console.error('Failed to delete record:', error);
      throw error;
    }
  }, []);

  const toggleFavorite = useCallback(async (id: string) => {
    try {
      const newValue = await toggleFavoriteDB(id);
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isFavorite: newValue } : r))
      );
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      throw error;
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadRecords(true);
  }, [loadRecords]);

  const loadStatistics = useCallback(async () => {
    try {
      const stats = await getStatistics();
      setStatistics(stats);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }, []);

  return {
    records,
    total,
    isLoading,
    filters,
    setFilters,
    loadMore,
    hasMore: records.length < total,
    deleteRecord,
    toggleFavorite,
    refresh,
    statistics,
    loadStatistics,
  };
}
