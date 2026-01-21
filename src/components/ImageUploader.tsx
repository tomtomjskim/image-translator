import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { IMAGE_CONFIG } from '../utils/constants';
import type { ImageItem } from '../types';

export function ImageUploader() {
  const { addImages, images, hasApiKey, setShowApiKeyModal } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  const createImageItem = (file: File): ImageItem => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    file,
    preview: URL.createObjectURL(file),
    status: 'pending',
  });

  const createImageItemFromUrl = (url: string): ImageItem => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    url,
    preview: url,
    status: 'pending',
  });

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      if (!hasApiKey) {
        setShowApiKeyModal(true);
        return;
      }

      const validFiles = Array.from(files).filter((file) => {
        if (!IMAGE_CONFIG.acceptedTypes.includes(file.type)) {
          alert(`지원하지 않는 파일 형식: ${file.name}`);
          return false;
        }
        if (file.size > IMAGE_CONFIG.maxSize) {
          alert(`파일 크기 초과 (최대 10MB): ${file.name}`);
          return false;
        }
        return true;
      });

      const remaining = IMAGE_CONFIG.maxCount - images.length;
      if (validFiles.length > remaining) {
        alert(`최대 ${IMAGE_CONFIG.maxCount}개의 이미지만 추가할 수 있습니다.`);
      }

      const newItems = validFiles.slice(0, remaining).map(createImageItem);
      if (newItems.length > 0) {
        addImages(newItems);
      }
    },
    [addImages, images.length, hasApiKey, setShowApiKeyModal]
  );

  // URL 문자열에서 여러 URL 추출 (쉼표, 줄바꿈, 공백 구분)
  const parseUrls = (input: string): string[] => {
    // 쉼표, 줄바꿈, 공백으로 분리
    const urls = input
      .split(/[\s,\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // 유효한 URL만 필터링
    return urls.filter((url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });
  };

  const handleUrlAdd = useCallback(() => {
    if (!urlInput.trim()) return;

    if (!hasApiKey) {
      setShowApiKeyModal(true);
      return;
    }

    const urls = parseUrls(urlInput);

    if (urls.length === 0) {
      alert('올바른 URL을 입력해주세요.');
      return;
    }

    const remaining = IMAGE_CONFIG.maxCount - images.length;
    if (remaining <= 0) {
      alert(`최대 ${IMAGE_CONFIG.maxCount}개의 이미지만 추가할 수 있습니다.`);
      return;
    }

    const urlsToAdd = urls.slice(0, remaining);
    if (urls.length > remaining) {
      alert(`${urls.length}개 중 ${urlsToAdd.length}개만 추가됩니다. (최대 ${IMAGE_CONFIG.maxCount}개)`);
    }

    addImages(urlsToAdd.map(createImageItemFromUrl));
    setUrlInput('');
  }, [urlInput, addImages, images.length, hasApiKey, setShowApiKeyModal]);

  // Drag & Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  // Paste handler
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const imageFiles: File[] = [];

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        handleFiles(imageFiles);
      }
    },
    [handleFiles]
  );

  return (
    <div className="space-y-4" onPaste={handlePaste}>
      {/* Drop Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_CONFIG.acceptedExtensions}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        <svg
          className="mx-auto h-12 w-12 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>

        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            클릭하여 파일 선택
          </span>{' '}
          또는 드래그 앤 드롭
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
          PNG, JPG, WebP, GIF (최대 10MB, {IMAGE_CONFIG.maxCount}개)
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
          Ctrl+V로 클립보드에서 붙여넣기 가능
        </p>
      </div>

      {/* URL Input */}
      <div className="flex gap-2">
        <textarea
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleUrlAdd();
            }
          }}
          placeholder="이미지 URL 입력... (여러 개는 쉼표, 줄바꿈으로 구분)"
          rows={2}
          className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        <button
          onClick={handleUrlAdd}
          className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors self-end"
        >
          추가
        </button>
      </div>
    </div>
  );
}
