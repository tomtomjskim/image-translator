# Phase 6: Chrome Extension 상세 구현 가이드

## 문서 정보

| 항목 | 내용 |
|------|------|
| **Phase** | 6 |
| **기능** | Chrome Extension 버전 |
| **우선순위** | P3 (선택) |
| **예상 소요** | 2주 |
| **상태** | 📋 설계 완료 |
| **의존성** | Phase 1-5 완료 권장 |

---

## 1. 기능 개요

### 1.1 목적
- 웹페이지 내 이미지 직접 선택 및 번역
- 브라우저 확장 기능으로 접근성 향상
- 쇼핑몰 브라우징 중 즉시 번역

### 1.2 주요 기능

| 기능 | 설명 |
|------|------|
| 컨텍스트 메뉴 | 이미지 우클릭 → "Image Translator로 번역" |
| 사이드 패널 | 번역 결과 표시 |
| 팝업 | 빠른 설정 및 상태 확인 |
| 단축키 | 선택 이미지 즉시 번역 |
| 배지 | 처리 상태 표시 |

### 1.3 지원 브라우저
- Chrome 116+ (MV3 필수)
- Edge (Chromium 기반)

---

## 2. 프로젝트 구조

### 2.1 디렉토리 구조

```
image-translator-extension/
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── background/
│   │   ├── service-worker.ts       # 백그라운드 스크립트
│   │   └── contextMenu.ts          # 컨텍스트 메뉴 설정
│   ├── content/
│   │   ├── content-script.ts       # 페이지 내 스크립트
│   │   ├── content-style.css       # 인젝션 스타일
│   │   └── imageSelector.ts        # 이미지 선택 로직
│   ├── popup/
│   │   ├── Popup.tsx               # 팝업 UI
│   │   ├── popup.html
│   │   └── popup.css
│   ├── sidepanel/
│   │   ├── SidePanel.tsx           # 사이드 패널 UI
│   │   ├── sidepanel.html
│   │   └── sidepanel.css
│   ├── options/
│   │   ├── Options.tsx             # 옵션 페이지
│   │   ├── options.html
│   │   └── options.css
│   ├── shared/
│   │   ├── services/
│   │   │   ├── gemini.ts           # API 서비스 (웹앱과 공유)
│   │   │   ├── crypto.ts           # 암호화 서비스
│   │   │   └── storage.ts          # Chrome Storage 래퍼
│   │   ├── stores/
│   │   │   └── useExtensionStore.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── utils/
│   │       └── constants.ts
│   └── components/
│       ├── TranslationResult.tsx
│       ├── LanguageSelector.tsx
│       └── common/
│           ├── Button.tsx
│           └── Spinner.tsx
├── public/
│   └── icons/
│       ├── icon16.png
│       ├── icon32.png
│       ├── icon48.png
│       └── icon128.png
└── _locales/
    ├── en/
    │   └── messages.json
    └── ko/
        └── messages.json
```

---

## 3. Manifest V3 설정

### 3.1 manifest.json

```json
{
  "manifest_version": 3,
  "name": "__MSG_extName__",
  "description": "__MSG_extDescription__",
  "version": "1.0.0",
  "default_locale": "ko",

  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },

  "permissions": [
    "activeTab",
    "storage",
    "contextMenus",
    "sidePanel"
  ],

  "host_permissions": [
    "https://generativelanguage.googleapis.com/*",
    "<all_urls>"
  ],

  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/content-script.js"],
      "css": ["src/content/content-style.css"],
      "run_at": "document_end"
    }
  ],

  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png"
    },
    "default_title": "__MSG_extName__"
  },

  "side_panel": {
    "default_path": "src/sidepanel/sidepanel.html"
  },

  "options_page": "src/options/options.html",

  "commands": {
    "_execute_action": {
      "suggested_key": {
        "default": "Ctrl+Shift+T",
        "mac": "Command+Shift+T"
      },
      "description": "__MSG_commandTranslate__"
    },
    "translate_selected": {
      "suggested_key": {
        "default": "Alt+T",
        "mac": "Option+T"
      },
      "description": "__MSG_commandTranslateSelected__"
    }
  },

  "web_accessible_resources": [
    {
      "resources": ["icons/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### 3.2 다국어 지원 (_locales)

```json
// _locales/ko/messages.json
{
  "extName": {
    "message": "Image Translator",
    "description": "확장 프로그램 이름"
  },
  "extDescription": {
    "message": "Gemini AI 기반 이미지 OCR 및 번역",
    "description": "확장 프로그램 설명"
  },
  "commandTranslate": {
    "message": "팝업 열기",
    "description": "팝업 열기 단축키"
  },
  "commandTranslateSelected": {
    "message": "선택 이미지 번역",
    "description": "선택 이미지 번역 단축키"
  },
  "contextMenuTranslate": {
    "message": "Image Translator로 번역",
    "description": "컨텍스트 메뉴 항목"
  }
}
```

---

## 4. 백그라운드 서비스 워커

### 4.1 service-worker.ts

```typescript
// src/background/service-worker.ts

import { setupContextMenu } from './contextMenu';
import { translateImageFromUrl } from '../shared/services/gemini';
import { getSettings, saveLastResult } from '../shared/services/storage';

// 확장 설치/업데이트 시
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed:', details.reason);

  // 컨텍스트 메뉴 설정
  setupContextMenu();

  // 사이드 패널 설정
  await chrome.sidePanel.setOptions({
    enabled: true,
  });

  // 기본 설정 초기화
  if (details.reason === 'install') {
    await chrome.storage.local.set({
      settings: {
        targetLanguage: 'ko',
        autoOpenSidePanel: true,
        translationTone: 'product',
      },
    });
  }
});

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRANSLATE_IMAGE') {
    handleTranslateImage(message.payload, sender.tab?.id)
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true; // 비동기 응답
  }

  if (message.type === 'GET_SETTINGS') {
    getSettings().then(sendResponse);
    return true;
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    if (sender.tab?.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id });
    }
    sendResponse({ success: true });
  }
});

// 이미지 번역 처리
async function handleTranslateImage(
  payload: { imageUrl?: string; imageBase64?: string },
  tabId?: number
): Promise<TranslationResult> {
  try {
    // 배지 업데이트 - 처리 중
    await updateBadge('...', '#FFA500');

    const settings = await getSettings();
    let result: TranslationResult;

    if (payload.imageUrl) {
      result = await translateImageFromUrl(
        payload.imageUrl,
        settings.targetLanguage,
        { tone: settings.translationTone }
      );
    } else if (payload.imageBase64) {
      result = await translateImageFromBase64(
        payload.imageBase64,
        settings.targetLanguage,
        { tone: settings.translationTone }
      );
    } else {
      throw new Error('No image provided');
    }

    // 결과 저장
    await saveLastResult(result);

    // 배지 업데이트 - 완료
    await updateBadge('✓', '#22C55E');
    setTimeout(() => updateBadge('', ''), 3000);

    // 사이드 패널 자동 열기
    if (settings.autoOpenSidePanel && tabId) {
      await chrome.sidePanel.open({ tabId });
    }

    return result;
  } catch (error) {
    // 배지 업데이트 - 에러
    await updateBadge('!', '#EF4444');
    throw error;
  }
}

// 배지 업데이트
async function updateBadge(text: string, color: string): Promise<void> {
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
}
```

### 4.2 contextMenu.ts

```typescript
// src/background/contextMenu.ts

export function setupContextMenu(): void {
  // 기존 메뉴 제거
  chrome.contextMenus.removeAll();

  // 이미지 컨텍스트 메뉴
  chrome.contextMenus.create({
    id: 'translate-image',
    title: chrome.i18n.getMessage('contextMenuTranslate'),
    contexts: ['image'],
  });

  // 선택 영역 컨텍스트 메뉴 (향후 확장)
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: '선택 영역 번역',
    contexts: ['selection'],
    visible: false, // 현재는 숨김
  });
}

// 컨텍스트 메뉴 클릭 핸들러
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'translate-image' && info.srcUrl) {
    // 이미지 URL로 번역 요청
    chrome.runtime.sendMessage({
      type: 'TRANSLATE_IMAGE',
      payload: { imageUrl: info.srcUrl },
    });
  }
});
```

---

## 5. 콘텐츠 스크립트

### 5.1 content-script.ts

```typescript
// src/content/content-script.ts

import { ImageSelector } from './imageSelector';

// 이미지 선택기 초기화
const imageSelector = new ImageSelector();

// 단축키 처리
document.addEventListener('keydown', (e) => {
  // Alt+T: 현재 호버 중인 이미지 번역
  if (e.altKey && e.key === 't') {
    const hoveredImage = document.querySelector('img:hover') as HTMLImageElement;
    if (hoveredImage) {
      translateImage(hoveredImage.src);
    }
  }
});

// 이미지 번역 요청
async function translateImage(imageUrl: string): Promise<void> {
  try {
    // 로딩 인디케이터 표시
    showLoadingIndicator();

    // 백그라운드로 번역 요청
    const response = await chrome.runtime.sendMessage({
      type: 'TRANSLATE_IMAGE',
      payload: { imageUrl },
    });

    hideLoadingIndicator();

    if (response.error) {
      showNotification('번역 실패: ' + response.error, 'error');
    } else {
      // 사이드 패널 열기 요청
      chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    }
  } catch (error) {
    hideLoadingIndicator();
    console.error('Translation failed:', error);
  }
}

// 로딩 인디케이터
function showLoadingIndicator(): void {
  const indicator = document.createElement('div');
  indicator.id = 'image-translator-loading';
  indicator.innerHTML = `
    <div class="it-loading-spinner"></div>
    <span>번역 중...</span>
  `;
  document.body.appendChild(indicator);
}

function hideLoadingIndicator(): void {
  const indicator = document.getElementById('image-translator-loading');
  indicator?.remove();
}

// 알림 표시
function showNotification(message: string, type: 'success' | 'error'): void {
  const notification = document.createElement('div');
  notification.className = `it-notification it-notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => notification.remove(), 3000);
}

// 메시지 리스너 (백그라운드에서의 요청 처리)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_IMAGE_DATA') {
    // 이미지 데이터 추출
    const img = document.querySelector(`img[src="${message.imageUrl}"]`) as HTMLImageElement;
    if (img) {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.9);
      sendResponse({ base64: base64.split(',')[1] });
    } else {
      sendResponse({ error: 'Image not found' });
    }
  }
});
```

### 5.2 content-style.css

```css
/* src/content/content-style.css */

#image-translator-loading {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 999999;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  color: #333;
}

.it-loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: it-spin 1s linear infinite;
}

@keyframes it-spin {
  to { transform: rotate(360deg); }
}

.it-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 999999;
  padding: 12px 20px;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  animation: it-slide-in 0.3s ease;
}

.it-notification-success {
  background: #dcfce7;
  color: #166534;
}

.it-notification-error {
  background: #fee2e2;
  color: #991b1b;
}

@keyframes it-slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 이미지 호버 하이라이트 */
img.it-hover-highlight {
  outline: 3px solid #3b82f6 !important;
  outline-offset: 2px;
  cursor: pointer;
}
```

---

## 6. 사이드 패널

### 6.1 SidePanel.tsx

```tsx
// src/sidepanel/SidePanel.tsx

import { useState, useEffect } from 'react';
import { TranslationResult } from '../components/TranslationResult';
import { LanguageSelector } from '../components/LanguageSelector';
import { getLastResult, getSettings, saveSettings } from '../shared/services/storage';

export function SidePanel() {
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [settings, setSettings] = useState({
    targetLanguage: 'ko',
    autoOpenSidePanel: true,
  });
  const [isLoading, setIsLoading] = useState(false);

  // 초기 로드
  useEffect(() => {
    loadData();

    // 스토리지 변경 감지
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.lastResult) {
        setResult(changes.lastResult.newValue);
      }
    });
  }, []);

  const loadData = async () => {
    const [lastResult, savedSettings] = await Promise.all([
      getLastResult(),
      getSettings(),
    ]);
    setResult(lastResult);
    setSettings(savedSettings);
  };

  const handleLanguageChange = async (language: string) => {
    const newSettings = { ...settings, targetLanguage: language };
    setSettings(newSettings);
    await saveSettings(newSettings);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900">
      {/* 헤더 */}
      <header className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <img src="/icons/icon32.png" alt="Logo" className="w-6 h-6" />
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Image Translator
          </h1>
        </div>

        {/* 언어 선택 */}
        <LanguageSelector
          value={settings.targetLanguage}
          onChange={handleLanguageChange}
        />
      </header>

      {/* 결과 영역 */}
      <main className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : result ? (
          <TranslationResult result={result} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-center">
              이미지를 우클릭하고<br />
              "Image Translator로 번역"을<br />
              선택해주세요
            </p>
          </div>
        )}
      </main>

      {/* 푸터 */}
      <footer className="p-3 border-t border-slate-200 dark:border-slate-700 text-center">
        <a
          href="https://141.148.168.113:3003"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline"
        >
          웹 버전 열기
        </a>
      </footer>
    </div>
  );
}
```

---

## 7. 팝업

### 7.1 Popup.tsx

```tsx
// src/popup/Popup.tsx

import { useState, useEffect } from 'react';
import { getSettings, saveSettings, getLastResult } from '../shared/services/storage';
import { Button } from '../components/common/Button';

export function Popup() {
  const [settings, setSettings] = useState({
    targetLanguage: 'ko',
    autoOpenSidePanel: true,
    translationTone: 'product',
  });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [lastResult, setLastResult] = useState<TranslationResult | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [savedSettings, result, apiKey] = await Promise.all([
      getSettings(),
      getLastResult(),
      chrome.storage.local.get('apiKey'),
    ]);
    setSettings(savedSettings);
    setLastResult(result);
    setHasApiKey(!!apiKey.apiKey);
  };

  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage();
  };

  const openSidePanel = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.sidePanel.open({ tabId: tabs[0].id });
      }
    });
    window.close();
  };

  return (
    <div className="w-80 p-4 bg-white">
      <div className="flex items-center gap-2 mb-4">
        <img src="/icons/icon32.png" alt="Logo" className="w-8 h-8" />
        <h1 className="text-lg font-bold text-slate-800">Image Translator</h1>
      </div>

      {/* API 키 상태 */}
      <div className={`p-3 rounded-lg mb-4 ${hasApiKey ? 'bg-green-50' : 'bg-amber-50'}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-green-500' : 'bg-amber-500'}`} />
          <span className={`text-sm ${hasApiKey ? 'text-green-700' : 'text-amber-700'}`}>
            {hasApiKey ? 'API 키 설정됨' : 'API 키 필요'}
          </span>
        </div>
        {!hasApiKey && (
          <button
            onClick={openOptionsPage}
            className="mt-2 text-xs text-amber-600 hover:underline"
          >
            설정에서 API 키 입력하기
          </button>
        )}
      </div>

      {/* 빠른 설정 */}
      <div className="space-y-3 mb-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">타겟 언어</label>
          <select
            value={settings.targetLanguage}
            onChange={async (e) => {
              const newSettings = { ...settings, targetLanguage: e.target.value };
              setSettings(newSettings);
              await saveSettings(newSettings);
            }}
            className="w-full px-3 py-2 text-sm border rounded-lg"
          >
            <option value="ko">한국어</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh-CN">简体中文</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-700">사이드 패널 자동 열기</span>
          <input
            type="checkbox"
            checked={settings.autoOpenSidePanel}
            onChange={async (e) => {
              const newSettings = { ...settings, autoOpenSidePanel: e.target.checked };
              setSettings(newSettings);
              await saveSettings(newSettings);
            }}
            className="rounded"
          />
        </div>
      </div>

      {/* 최근 번역 */}
      {lastResult && (
        <div className="p-3 bg-slate-50 rounded-lg mb-4">
          <p className="text-xs text-slate-500 mb-1">최근 번역</p>
          <p className="text-sm text-slate-800 line-clamp-2">
            {lastResult.translatedText}
          </p>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="space-y-2">
        <Button onClick={openSidePanel} className="w-full">
          사이드 패널 열기
        </Button>
        <button
          onClick={openOptionsPage}
          className="w-full py-2 text-sm text-slate-600 hover:text-slate-800"
        >
          상세 설정
        </button>
      </div>

      {/* 사용 안내 */}
      <p className="mt-4 text-xs text-slate-400 text-center">
        이미지를 우클릭하여 번역하거나<br />
        Alt+T로 호버 중인 이미지를 번역하세요
      </p>
    </div>
  );
}
```

---

## 8. Storage 서비스

```typescript
// src/shared/services/storage.ts

import type { TranslationResult, Settings } from '../types';

const STORAGE_KEYS = {
  apiKey: 'apiKey',
  settings: 'settings',
  lastResult: 'lastResult',
  history: 'history',
};

// API 키 관리
export async function saveApiKey(apiKey: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.apiKey]: apiKey });
}

export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.apiKey);
  return result[STORAGE_KEYS.apiKey] || null;
}

export async function removeApiKey(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.apiKey);
}

// 설정 관리
export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({
    [STORAGE_KEYS.settings]: { ...current, ...settings },
  });
}

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  return {
    targetLanguage: 'ko',
    autoOpenSidePanel: true,
    translationTone: 'product',
    ...result[STORAGE_KEYS.settings],
  };
}

// 마지막 결과
export async function saveLastResult(result: TranslationResult): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.lastResult]: result });
}

export async function getLastResult(): Promise<TranslationResult | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.lastResult);
  return result[STORAGE_KEYS.lastResult] || null;
}
```

---

## 9. 빌드 설정

### 9.1 vite.config.ts

```typescript
// vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/popup.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/sidepanel.html'),
        options: resolve(__dirname, 'src/options/options.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        'content-script': resolve(__dirname, 'src/content/content-script.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
```

### 9.2 package.json scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "build:watch": "vite build --watch",
    "zip": "cd dist && zip -r ../image-translator-extension.zip *"
  }
}
```

---

## 10. 구현 체크리스트

### 10.1 프로젝트 설정
- [ ] 프로젝트 초기화 (Vite + React + TypeScript)
- [ ] manifest.json 작성
- [ ] 다국어 파일 작성
- [ ] 아이콘 생성

### 10.2 백그라운드
- [ ] service-worker.ts
- [ ] contextMenu.ts
- [ ] 메시지 핸들링

### 10.3 콘텐츠 스크립트
- [ ] content-script.ts
- [ ] content-style.css
- [ ] 이미지 선택 로직

### 10.4 UI
- [ ] Popup
- [ ] SidePanel
- [ ] Options 페이지

### 10.5 서비스
- [ ] storage.ts (Chrome Storage 래퍼)
- [ ] gemini.ts (API 서비스 공유)

### 10.6 배포
- [ ] Chrome Web Store 등록
- [ ] 스크린샷 및 설명 작성

---

## 11. Chrome Web Store 배포

### 11.1 필요 자료
- 확장 프로그램 ZIP 파일
- 스크린샷 (1280x800 또는 640x400)
- 프로모션 이미지 (440x280, 920x680, 1400x560)
- 아이콘 (128x128)
- 개인정보처리방침 URL

### 11.2 심사 대비
- host_permissions 최소화
- 권한 사용 사유 명시
- 테스트 계정/데이터 제공

---

*문서 버전: 1.0.0*
*최종 수정: 2026-01-20*
