import { create } from 'zustand';
import type { AppState, ImageItem, AppSettings } from '../types';
import { hasStoredApiKey } from '../services/crypto';

const defaultSettings: AppSettings = {
  sourceLanguage: 'auto',
  targetLanguage: 'ko',
  translationTone: 'product',
};

export const useAppStore = create<AppState>((set) => ({
  // API Key
  hasApiKey: hasStoredApiKey(),
  setHasApiKey: (value) => set({ hasApiKey: value }),

  // Images
  images: [],
  addImages: (items) =>
    set((state) => ({
      images: [...state.images, ...items].slice(0, 10), // 최대 10개
    })),
  updateImage: (id, updates) =>
    set((state) => ({
      images: state.images.map((img) =>
        img.id === id ? { ...img, ...updates } : img
      ),
    })),
  removeImage: (id) =>
    set((state) => ({
      images: state.images.filter((img) => img.id !== id),
    })),
  clearImages: () => set({ images: [] }),

  // Settings
  settings: defaultSettings,
  updateSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates },
    })),

  // UI State
  isProcessing: false,
  setIsProcessing: (value) => set({ isProcessing: value }),
  showApiKeyModal: false,
  setShowApiKeyModal: (value) => set({ showApiKeyModal: value }),
}));
