import { create } from 'zustand';
import type { AppState, AppSettings, Resolution, AspectRatio } from '../types';
import { hasStoredApiKey } from '../services/crypto';
import { IMAGE_CONFIG } from '../utils/constants';

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
      images: [...state.images, ...items].slice(0, IMAGE_CONFIG.maxCount),
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

  // Image Generation (Phase 2)
  imageGenerationEnabled: true,
  setImageGenerationEnabled: (enabled) => set({ imageGenerationEnabled: enabled }),
  defaultResolution: '2K' as Resolution,
  setDefaultResolution: (resolution) => set({ defaultResolution: resolution }),
  defaultAspectRatio: 'original' as AspectRatio,
  setDefaultAspectRatio: (aspectRatio) => set({ defaultAspectRatio: aspectRatio }),

  // History (Phase 3)
  showHistoryPanel: false,
  setShowHistoryPanel: (value) => set({ showHistoryPanel: value }),
  autoSaveHistory: true,
  setAutoSaveHistory: (value) => set({ autoSaveHistory: value }),
}));
