# 이미지 번역 웹 서비스 기획서

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **서비스명** | Image Translator |
| **목적** | 해외 소싱 상품 이미지의 텍스트를 OCR로 인식하여 번역 |
| **타겟 사용자** | 스마트스토어 셀러, 해외 소싱 사업자 |
| **핵심 기능** | 이미지 OCR → 번역 → 결과 반환 (선택적 이미지 재생성) |

---

## 2. API 모델 정보 (2026년 1월 기준)

### 2.1 사용 모델

| 용도 | 모델명 | API 모델 ID | 특징 |
|------|--------|-------------|------|
| **OCR + 번역** | Gemini 2.0 Flash | `gemini-2.0-flash-exp` | 빠른 이미지 인식, 멀티모달 지원 |
| **이미지 재생성** | Nano Banana Pro | `gemini-3-pro-image-preview` | Thinking Mode, 텍스트 렌더링 우수 |

### 2.2 Nano Banana Pro (Gemini 3 Pro Image) 상세

- **Thinking Mode**: 기본 활성화 (비활성화 불가)
  - 복잡한 프롬프트를 chain-of-thought 추론으로 처리
  - 최종 출력 전 내부적으로 'thought images' 생성하여 구성 정제
- **지원 해상도**: 1K, 2K, 4K
- **지원 비율**: 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
- **참조 이미지**: 최대 14개 (객체 6개 + 인물 5개)
- **텍스트 렌더링**: 가독성 높은 스타일 텍스트 지원

### 2.3 API 설정

```javascript
// OCR + 번역용 설정
const ocrConfig = {
  model: 'gemini-2.0-flash-exp',
  generationConfig: {
    responseModalities: ['TEXT']
  }
};

// 이미지 생성용 설정 (Thinking Mode 자동 활성화)
const imageGenConfig = {
  model: 'gemini-3-pro-image-preview',
  generationConfig: {
    responseModalities: ['TEXT', 'IMAGE'],
    imageOutputSettings: {
      aspectRatio: '1:1',
      resolution: '2K'
    }
  }
};
```

---

## 3. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 브라우저                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ 이미지 입력   │  │  언어 설정   │  │   API 키 관리 (암호화)   │  │
│  │ URL/파일/다중 │  │ 소스→타겟   │  │   localStorage + AES    │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
│         │                │                      │               │
│         └────────────────┼──────────────────────┘               │
│                          ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    처리 파이프라인                          │  │
│  │  1. 이미지 → Base64 인코딩                                 │  │
│  │  2. Gemini 2.0 Flash → OCR + 번역                         │  │
│  │  3. (선택) Nano Banana Pro → 번역 텍스트 이미지 생성        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                      결과 출력                              │  │
│  │  • 원본 이미지 + 추출 텍스트 + 번역 텍스트                   │  │
│  │  • (선택) 번역 텍스트가 포함된 새 이미지                     │  │
│  │  • 복사 / 다운로드 기능                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Google Gemini API   │
              │  • gemini-2.0-flash   │
              │  • gemini-3-pro-image │
              └───────────────────────┘
```

---

## 4. 주요 기능 명세

### 4.1 이미지 입력
- [x] 이미지 파일 업로드 (다중 선택)
- [x] 이미지 URL 입력 (다중)
- [x] 드래그 앤 드롭
- [x] 클립보드 붙여넣기 (Ctrl+V)
- [x] 지원 형식: PNG, JPG, JPEG, WebP, GIF
- [x] 최대 크기: 10MB per image

### 4.2 번역 설정
- [x] 소스 언어: 자동 감지 / 수동 선택
- [x] 타겟 언어: 한국어, 영어, 중국어(간체/번체), 일본어, 베트남어, 태국어
- [x] 번역 톤: 일반 / 상품설명 최적화 / 격식체

### 4.3 결과 출력
- [x] 원본 이미지 표시
- [x] 추출된 원문 텍스트
- [x] 번역된 텍스트
- [x] 텍스트 복사 버튼
- [x] JSON 내보내기
- [ ] (Phase 2) 이미지 재생성 옵션

### 4.4 API 키 관리
- [x] AES-256-GCM 암호화 저장
- [x] Web Crypto API 사용
- [x] 마스킹 표시 (앞 4자리만 표시)
- [x] 키 삭제 기능

---

## 5. 보안 설계

### 5.1 API 키 암호화 흐름

```
사용자 API 키 입력
        ↓
브라우저 핑거프린트 생성 (deviceId)
        ↓
Web Crypto API로 AES-256-GCM 키 생성
        ↓
API 키 암호화 + IV 저장
        ↓
localStorage에 저장: { encrypted, iv }
        ↓
사용 시: 복호화 → API 호출 → 메모리 즉시 삭제
```

---

## 6. 기술 스택

| 영역 | 기술 | 버전 | 선정 이유 |
|------|------|------|----------|
| **빌드** | Vite | 7.x | 빠른 HMR, ES 모듈 기반 |
| **프레임워크** | React | 18.x | 컴포넌트 기반, 생태계 풍부 |
| **언어** | TypeScript | 5.x | 타입 안정성 |
| **스타일** | Tailwind CSS | 4.x | 유틸리티 기반, 빠른 개발 |
| **상태관리** | Zustand | 4.x | 가볍고 간단 |
| **HTTP** | @google/generative-ai | latest | 공식 SDK |
| **암호화** | Web Crypto API | - | 브라우저 내장, 안전 |

---

## 7. 폴더 구조

```
image-translator/
├── docs/
│   └── PROJECT_PLAN.md          # 기획서 (현재 문서)
├── public/
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   └── Modal.tsx
│   │   ├── ApiKeyManager.tsx
│   │   ├── ImageUploader.tsx
│   │   ├── ImagePreview.tsx
│   │   ├── LanguageSelector.tsx
│   │   ├── TranslationResult.tsx
│   │   └── Header.tsx
│   ├── services/
│   │   ├── gemini.ts
│   │   └── crypto.ts
│   ├── stores/
│   │   └── useAppStore.ts
│   ├── hooks/
│   │   ├── useApiKey.ts
│   │   └── useTranslation.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   └── constants.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 8. 개발 체크리스트

### Phase 1: 프로젝트 초기 설정 ✅
- [x] Vite + React + TypeScript 프로젝트 생성
- [x] Tailwind CSS 설정
- [x] 폴더 구조 생성
- [x] Git 저장소 초기화

### Phase 2: 핵심 인프라 ✅
- [x] API 키 암호화/복호화 모듈 (crypto.ts)
- [x] API 키 관리 컴포넌트 (ApiKeyManager.tsx)
- [x] Zustand 스토어 설정
- [x] 타입 정의

### Phase 3: 이미지 처리 ✅
- [x] 이미지 업로드 컴포넌트
- [x] 드래그앤드롭 + 클립보드 지원
- [x] 이미지 미리보기
- [x] Base64 인코딩 처리

### Phase 4: API 연동 ✅
- [x] Gemini API 서비스 모듈
- [x] OCR + 번역 프롬프트 설계
- [x] 에러 핸들링
- [x] 로딩 상태 관리

### Phase 5: UI/UX ✅
- [x] 메인 레이아웃
- [x] 언어 선택 UI
- [x] 번역 결과 표시
- [x] 복사/다운로드 기능
- [x] 반응형 디자인
- [x] 다크모드 지원

### Phase 6: 배포
- [ ] 빌드 최적화
- [ ] 정적 호스팅 배포 (Vercel/Netlify/GitHub Pages)

---

## 9. 향후 계획 (v2.0)

1. Nano Banana Pro를 활용한 번역 이미지 자동 생성
2. 번역 히스토리 저장 (IndexedDB)
3. 번역 메모리/용어집 기능
4. Chrome Extension 버전

---

## 참고 자료

- [Gemini API 공식 문서](https://ai.google.dev/gemini-api/docs)
- [Nano Banana Image Generation](https://ai.google.dev/gemini-api/docs/nanobanana)
- [Google AI for Developers](https://ai.google.dev/)

---

*문서 버전: 1.0*
*최종 수정: 2026-01-20*
