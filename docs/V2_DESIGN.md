# Image Translator v2.0 설계 문서

## 문서 정보

| 항목 | 내용 |
|------|------|
| **버전** | 2.0.0 (설계) |
| **작성일** | 2026-01-20 |
| **상태** | 설계 단계 |

---

## 1. 개요

### 1.1 v2.0 목표
- Nano Banana Pro (Gemini 3 Pro Image)를 활용한 번역 이미지 자동 생성
- 번역 히스토리 및 용어집 기능으로 생산성 향상
- Chrome Extension으로 접근성 개선
- HTTPS 적용으로 보안 강화

### 1.2 주요 기능 목록

| 우선순위 | 기능 | 복잡도 | 예상 Phase |
|---------|------|--------|-----------|
| P0 | HTTPS 설정 (보안 강화) | 낮음 | Phase 1 |
| P1 | 번역 이미지 자동 생성 | 높음 | Phase 2 |
| P1 | 번역 히스토리 저장 | 중간 | Phase 3 |
| P2 | 번역 메모리/용어집 | 중간 | Phase 4 |
| P2 | 다중 이미지 일괄 처리 개선 | 중간 | Phase 5 |
| P3 | Chrome Extension | 높음 | Phase 6 |

---

## 2. Phase 1: HTTPS 설정

### 2.1 목적
- Web Crypto API의 완전한 지원 (AES-256-GCM 암호화)
- 보안 강화 및 브라우저 경고 제거

### 2.2 구현 방안

#### Option A: Let's Encrypt + 도메인
```nginx
# /home/ubuntu/nginx/conf.d/ssl.conf
server {
    listen 443 ssl http2;
    server_name image-translator.example.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://172.20.0.18:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

#### Option B: Self-Signed (개발/테스트)
```bash
# 자체 서명 인증서 생성
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /home/ubuntu/nginx/ssl/selfsigned.key \
    -out /home/ubuntu/nginx/ssl/selfsigned.crt
```

### 2.3 작업 체크리스트
- [ ] 도메인 구매 또는 서브도메인 설정
- [ ] Certbot 설치 및 Let's Encrypt 인증서 발급
- [ ] Nginx SSL 설정 추가
- [ ] HTTP → HTTPS 리다이렉트 설정
- [ ] docker-compose.yml에 443 포트 추가

---

## 3. Phase 2: 번역 이미지 자동 생성

### 3.1 Nano Banana Pro API 상세

```typescript
// src/services/gemini.ts 확장

interface ImageGenerationConfig {
  model: 'gemini-3-pro-image-preview';
  generationConfig: {
    responseModalities: ['TEXT', 'IMAGE'];
    imageOutputSettings: {
      aspectRatio: AspectRatio;
      resolution: Resolution;
    };
  };
}

type AspectRatio = '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
type Resolution = '1K' | '2K' | '4K';
```

### 3.2 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        번역 이미지 생성 Flow                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. OCR + 번역 (Gemini 2.0 Flash)                               │
│     ↓                                                           │
│  2. 사용자 확인 (번역 텍스트 검토/수정)                            │
│     ↓                                                           │
│  3. 이미지 생성 요청 (Nano Banana Pro)                           │
│     • 원본 이미지 + 번역 텍스트 전달                              │
│     • Thinking Mode 자동 활성화                                  │
│     ↓                                                           │
│  4. 생성된 이미지 표시 및 다운로드                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 프롬프트 설계

```typescript
// 이미지 생성 프롬프트
const IMAGE_GEN_PROMPT = `
You are an expert image editor specializing in product image localization.

Task: Create a new version of the product image with translated text.

Original Image Context:
{ORIGINAL_IMAGE_DESCRIPTION}

Text Replacements:
{TEXT_MAPPING}

Requirements:
1. Maintain the original image's style, colors, and composition
2. Replace ALL visible text with the translated versions
3. Ensure text is readable with appropriate font size and contrast
4. Keep brand names, logos, and model numbers unchanged
5. Professional e-commerce quality output

Output: Generate the modified product image.
`;
```

### 3.4 UI/UX 설계

```
┌──────────────────────────────────────────────────────────────┐
│  번역 결과                                                    │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────┐   ┌────────────────┐                    │
│  │   원본 이미지    │   │   번역 이미지    │ ← NEW            │
│  │                │   │   (생성 중...)   │                   │
│  └────────────────┘   └────────────────┘                    │
│                                                              │
│  원문: 중국어 상품 설명...                                    │
│  번역: 한국어 번역 결과...                                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 이미지 생성 옵션                                         │ │
│  │  • 해상도: [1K] [2K] [4K]                                │ │
│  │  • 비율:   [원본유지] [1:1] [4:3] [16:9]                 │ │
│  │  • [번역 이미지 생성] 버튼                                │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  [복사] [JSON] [이미지 다운로드]                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.5 컴포넌트 구조

```
src/components/
├── ImageGenerator/
│   ├── ImageGenerator.tsx      # 메인 컴포넌트
│   ├── GenerationOptions.tsx   # 해상도/비율 옵션
│   ├── ImageComparison.tsx     # 원본/생성 이미지 비교
│   └── GenerationProgress.tsx  # 생성 진행 상태
```

### 3.6 타입 정의

```typescript
// src/types/index.ts 추가

export interface ImageGenerationRequest {
  originalImage: string;          // Base64
  translatedTexts: TextMapping[];
  aspectRatio: AspectRatio;
  resolution: Resolution;
}

export interface TextMapping {
  original: string;
  translated: string;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ImageGenerationResult {
  success: boolean;
  generatedImage?: string;        // Base64
  error?: string;
  thinkingProcess?: string;       // Thinking Mode 내용 (디버깅용)
}
```

### 3.7 서비스 레이어

```typescript
// src/services/imageGeneration.ts

export async function generateTranslatedImage(
  request: ImageGenerationRequest
): Promise<ImageGenerationResult> {
  const model = genAI.getGenerativeModel({
    model: GEMINI_CONFIG.imageModel,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageOutputSettings: {
        aspectRatio: request.aspectRatio,
        resolution: request.resolution,
      },
    },
  });

  const prompt = buildImageGenPrompt(request);

  const result = await model.generateContent([
    { inlineData: { mimeType: 'image/jpeg', data: request.originalImage } },
    { text: prompt },
  ]);

  return parseImageGenerationResponse(result);
}
```

---

## 4. Phase 3: 번역 히스토리 저장

### 4.1 IndexedDB 스키마

```typescript
// src/services/db.ts

interface TranslationHistoryDB {
  translations: {
    key: string;                  // UUID
    value: TranslationRecord;
    indexes: {
      'by-date': Date;
      'by-source': string;
      'by-target': string;
    };
  };
  settings: {
    key: string;
    value: unknown;
  };
}

interface TranslationRecord {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  sourceImage: {
    thumbnail: string;            // 압축된 썸네일
    originalUrl?: string;
  };
  sourceLanguage: string;
  targetLanguage: string;
  originalText: string;
  translatedText: string;
  translationTone: TranslationTone;
  generatedImage?: string;        // 생성된 이미지 (선택적)
  metadata: {
    confidence: string;
    processingTime: number;
  };
}
```

### 4.2 Dexie.js 활용

```typescript
// src/services/db.ts
import Dexie from 'dexie';

class TranslationDatabase extends Dexie {
  translations!: Dexie.Table<TranslationRecord, string>;

  constructor() {
    super('ImageTranslatorDB');
    this.version(1).stores({
      translations: 'id, createdAt, sourceLanguage, targetLanguage'
    });
  }
}

export const db = new TranslationDatabase();

// CRUD 함수
export async function saveTranslation(record: TranslationRecord): Promise<string> {
  return await db.translations.add(record);
}

export async function getTranslations(
  options: { limit?: number; offset?: number; filter?: Partial<TranslationRecord> }
): Promise<TranslationRecord[]> {
  let query = db.translations.orderBy('createdAt').reverse();

  if (options.filter?.sourceLanguage) {
    query = query.filter(r => r.sourceLanguage === options.filter!.sourceLanguage);
  }

  if (options.offset) query = query.offset(options.offset);
  if (options.limit) query = query.limit(options.limit);

  return await query.toArray();
}

export async function deleteTranslation(id: string): Promise<void> {
  await db.translations.delete(id);
}

export async function clearAllTranslations(): Promise<void> {
  await db.translations.clear();
}
```

### 4.3 UI 컴포넌트

```
src/components/History/
├── HistoryPanel.tsx           # 히스토리 사이드 패널
├── HistoryItem.tsx            # 개별 히스토리 아이템
├── HistorySearch.tsx          # 검색/필터
└── HistoryExport.tsx          # 일괄 내보내기
```

### 4.4 히스토리 패널 레이아웃

```
┌─────────────────────────────────────────┐
│  번역 히스토리                     [X]  │
├─────────────────────────────────────────┤
│  [검색...               ] [필터 ▼]      │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐│
│  │ [썸네일] 2026-01-20 15:30          ││
│  │ 中文 → 한국어                       ││
│  │ "商品说明..." → "상품 설명..."       ││
│  │ [복사] [재번역] [삭제]              ││
│  └─────────────────────────────────────┘│
│  ┌─────────────────────────────────────┐│
│  │ [썸네일] 2026-01-20 14:15          ││
│  │ ...                                 ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  전체 50건 | [전체 삭제] [JSON 내보내기] │
└─────────────────────────────────────────┘
```

---

## 5. Phase 4: 번역 메모리/용어집

### 5.1 개념

```
┌─────────────────────────────────────────────────────────────────┐
│                         번역 메모리 시스템                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  용어집 (Glossary):                                             │
│  • 사용자 정의 번역 쌍 등록                                      │
│  • 브랜드명, 기술 용어 등 일관성 유지                             │
│  • 예: "Free Shipping" → "무료배송" (항상 이 번역 사용)          │
│                                                                 │
│  번역 메모리 (TM):                                              │
│  • 이전 번역 결과 자동 저장                                      │
│  • 유사 문장 재사용 제안                                         │
│  • 번역 일관성 향상                                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 IndexedDB 스키마 확장

```typescript
interface GlossaryEntry {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceTerm: string;
  targetTerm: string;
  category?: string;            // 'brand', 'technical', 'common'
  caseSensitive: boolean;
  createdAt: Date;
}

interface TranslationMemory {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceSegment: string;
  targetSegment: string;
  usageCount: number;
  lastUsed: Date;
  context?: string;             // 어떤 이미지에서 사용되었는지
}
```

### 5.3 프롬프트 통합

```typescript
// 용어집을 프롬프트에 포함
function buildPromptWithGlossary(
  basePrompt: string,
  glossary: GlossaryEntry[]
): string {
  if (glossary.length === 0) return basePrompt;

  const glossaryText = glossary
    .map(e => `• "${e.sourceTerm}" → "${e.targetTerm}"`)
    .join('\n');

  return `${basePrompt}

IMPORTANT - Use these exact translations for the following terms:
${glossaryText}
`;
}
```

### 5.4 UI 설계

```
┌──────────────────────────────────────────────────────────────────┐
│  용어집 관리                                                      │
├──────────────────────────────────────────────────────────────────┤
│  [+ 용어 추가]  [CSV 가져오기]  [CSV 내보내기]                    │
├──────────────────────────────────────────────────────────────────┤
│  원문              번역              카테고리      액션            │
│  ─────────────────────────────────────────────────────────────── │
│  Free Shipping     무료배송          일반          [수정] [삭제]  │
│  Premium Quality   프리미엄 품질     마케팅        [수정] [삭제]  │
│  Waterproof        방수              기술          [수정] [삭제]  │
│  ...                                                             │
├──────────────────────────────────────────────────────────────────┤
│  총 25개 용어 등록됨                                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Phase 5: 다중 이미지 일괄 처리 개선

### 6.1 현재 문제점
- 순차 처리로 인한 대기 시간
- 진행 상태 표시 부족
- 일부 실패 시 전체 중단

### 6.2 개선 방안

```typescript
// 병렬 처리 with 동시성 제한
async function translateImagesBatch(
  images: ImageItem[],
  options: TranslationOptions,
  onProgress: (progress: BatchProgress) => void
): Promise<BatchResult> {
  const CONCURRENCY_LIMIT = 3;
  const results: TranslationResult[] = [];
  const errors: BatchError[] = [];

  // 청크 단위 병렬 처리
  for (let i = 0; i < images.length; i += CONCURRENCY_LIMIT) {
    const chunk = images.slice(i, i + CONCURRENCY_LIMIT);

    const chunkResults = await Promise.allSettled(
      chunk.map(img => translateImage(img, options))
    );

    chunkResults.forEach((result, idx) => {
      const imageIndex = i + idx;
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push({
          imageIndex,
          imageName: images[imageIndex].name,
          error: result.reason.message,
        });
      }

      onProgress({
        completed: results.length + errors.length,
        total: images.length,
        currentImage: images[imageIndex].name,
        errors: errors.length,
      });
    });
  }

  return { results, errors };
}
```

### 6.3 진행 상태 UI

```
┌──────────────────────────────────────────────────────────────────┐
│  일괄 번역 진행 중                                                │
├──────────────────────────────────────────────────────────────────┤
│  ████████████████░░░░░░░░░░░░░░  8/20 완료 (40%)                │
│                                                                  │
│  ✓ product_001.jpg - 완료                                        │
│  ✓ product_002.jpg - 완료                                        │
│  ⟳ product_003.jpg - 처리 중...                                  │
│  ⟳ product_004.jpg - 처리 중...                                  │
│  ⟳ product_005.jpg - 처리 중...                                  │
│  ○ product_006.jpg - 대기 중                                     │
│  ✗ product_007.jpg - 실패 (이미지 형식 오류)                      │
│  ...                                                             │
├──────────────────────────────────────────────────────────────────┤
│  성공: 7 | 실패: 1 | 대기: 12                    [취소]           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 7. Phase 6: Chrome Extension

### 7.1 개요
- 웹페이지 내 이미지 직접 선택 및 번역
- 컨텍스트 메뉴 통합
- 사이드 패널 UI

### 7.2 디렉토리 구조

```
image-translator-extension/
├── manifest.json
├── src/
│   ├── background/
│   │   └── service-worker.ts     # 백그라운드 스크립트
│   ├── content/
│   │   └── content-script.ts     # 페이지 내 스크립트
│   ├── popup/
│   │   ├── Popup.tsx             # 팝업 UI
│   │   └── popup.html
│   ├── sidepanel/
│   │   ├── SidePanel.tsx         # 사이드 패널 UI
│   │   └── sidepanel.html
│   └── shared/
│       ├── services/             # 공유 서비스 (gemini, crypto)
│       ├── stores/               # 공유 상태
│       └── types/
├── public/
│   └── icons/
├── vite.config.ts
└── package.json
```

### 7.3 manifest.json (MV3)

```json
{
  "manifest_version": 3,
  "name": "Image Translator",
  "version": "1.0.0",
  "description": "Gemini AI 기반 이미지 OCR 및 번역",
  "permissions": [
    "activeTab",
    "storage",
    "contextMenus",
    "sidePanel"
  ],
  "host_permissions": [
    "https://generativelanguage.googleapis.com/*"
  ],
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/content-script.js"],
      "css": ["src/content/content-style.css"]
    }
  ],
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "public/icons/icon16.png",
      "48": "public/icons/icon48.png",
      "128": "public/icons/icon128.png"
    }
  },
  "side_panel": {
    "default_path": "src/sidepanel/sidepanel.html"
  },
  "icons": {
    "16": "public/icons/icon16.png",
    "48": "public/icons/icon48.png",
    "128": "public/icons/icon128.png"
  }
}
```

### 7.4 기능 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome Extension Flow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 사용자가 웹페이지에서 이미지 우클릭                           │
│     ↓                                                           │
│  2. 컨텍스트 메뉴: "Image Translator로 번역"                     │
│     ↓                                                           │
│  3. 사이드 패널 자동 오픈                                        │
│     ↓                                                           │
│  4. 이미지 로드 및 번역 처리 (기존 로직 재사용)                   │
│     ↓                                                           │
│  5. 결과 표시 및 복사/다운로드                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. 기술 부채 및 개선 사항

### 8.1 v1.0 기술 부채
- [ ] 에러 바운더리 컴포넌트 추가
- [ ] 로딩 스켈레톤 UI 적용
- [ ] 접근성(a11y) 개선
- [ ] 단위 테스트 추가 (Vitest)
- [ ] E2E 테스트 추가 (Playwright)

### 8.2 성능 최적화
- [ ] 이미지 리사이징 (클라이언트 사이드)
- [ ] 결과 캐싱 (동일 이미지 재번역 방지)
- [ ] 레이지 로딩 적용
- [ ] 번들 사이즈 최적화

### 8.3 모니터링
- [ ] 에러 트래킹 (Sentry)
- [ ] 사용량 분석 (간단한 통계)

---

## 9. 마일스톤

```
Phase 1: HTTPS 설정              ─────────────────  Week 1
Phase 2: 이미지 생성 기능        ─────────────────  Week 2-3
Phase 3: 히스토리 저장           ─────────────────  Week 4
Phase 4: 용어집 기능             ─────────────────  Week 5
Phase 5: 일괄 처리 개선          ─────────────────  Week 6
Phase 6: Chrome Extension        ─────────────────  Week 7-8

v2.0 릴리스 목표: 8주 후
```

---

## 10. 의존성 추가 예정

```json
{
  "dependencies": {
    "dexie": "^4.0.0",           // IndexedDB 래퍼
    "idb": "^8.0.0",             // 대안 (더 가벼움)
    "browser-image-compression": "^2.0.0",  // 이미지 압축
    "uuid": "^9.0.0"             // UUID 생성
  },
  "devDependencies": {
    "vitest": "^2.0.0",          // 단위 테스트
    "@playwright/test": "^1.40.0" // E2E 테스트
  }
}
```

---

## 11. 참고 자료

- [Gemini API - Image Generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [Nano Banana Pro Documentation](https://ai.google.dev/gemini-api/docs/nanobanana)
- [Chrome Extensions MV3](https://developer.chrome.com/docs/extensions/mv3/)
- [IndexedDB MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Dexie.js](https://dexie.org/)

---

*문서 버전: 2.0.0-design*
*최종 수정: 2026-01-20*
