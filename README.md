# Image Translator

Gemini AI 기반 이미지 OCR 및 번역 웹 서비스

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.x-61dafb.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)

## 개요

스마트스토어 셀러 및 해외 소싱 사업자를 위한 이미지 번역 도구입니다.
상품 이미지에서 텍스트를 자동으로 추출(OCR)하고 원하는 언어로 번역합니다.

### 주요 기능

- **이미지 OCR**: Gemini 2.0 Flash를 활용한 정확한 텍스트 추출
- **다국어 번역**: 한국어, 영어, 중국어, 일본어 등 10개 언어 지원
- **다양한 입력 방식**: 파일 업로드, URL, 드래그앤드롭, 클립보드 붙여넣기
- **번역 톤 선택**: 일반/상품설명/격식체 모드
- **보안 API 키 저장**: AES-256-GCM 암호화로 브라우저에 안전하게 저장
- **다크모드 지원**: 시스템 설정에 따른 자동 테마 변경

## 기술 스택

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **AI API**: Google Gemini API (@google/generative-ai)
- **Encryption**: Web Crypto API (AES-256-GCM)

## 시작하기

### 요구사항

- Node.js 20.x 이상
- npm 또는 yarn
- Gemini API Key ([Google AI Studio](https://aistudio.google.com/apikey)에서 무료 발급)

### 설치

```bash
# 저장소 클론
git clone https://github.com/your-username/image-translator.git
cd image-translator

# 의존성 설치
npm install

# 개발 서버 시작
npm run dev
```

### 빌드

```bash
# 프로덕션 빌드
npm run build

# 빌드 결과물 미리보기
npm run preview
```

## 사용 방법

1. **API Key 설정**: 오른쪽 상단의 "API Key 필요" 버튼 클릭 → Gemini API Key 입력
2. **언어 설정**: 소스 언어(자동감지 권장)와 타겟 언어 선택
3. **이미지 업로드**: 드래그앤드롭, 파일 선택, URL 입력 중 원하는 방식으로 이미지 추가
4. **번역 실행**: "번역" 버튼 클릭
5. **결과 확인**: 원문과 번역문 확인 후 복사 또는 JSON 내보내기

## 프로젝트 구조

```
src/
├── components/         # React 컴포넌트
│   ├── common/        # 공통 UI 컴포넌트
│   ├── ApiKeyManager  # API 키 관리
│   ├── ImageUploader  # 이미지 업로드
│   └── ...
├── services/          # 비즈니스 로직
│   ├── gemini.ts      # Gemini API 연동
│   └── crypto.ts      # 암호화/복호화
├── stores/            # Zustand 상태 관리
├── hooks/             # Custom Hooks
├── types/             # TypeScript 타입 정의
└── utils/             # 유틸리티 함수
```

## API 모델

| 용도 | 모델 | 설명 |
|------|------|------|
| OCR + 번역 | `gemini-2.0-flash-exp` | 빠른 이미지 인식 및 번역 |
| 이미지 생성 (예정) | `gemini-3-pro-image-preview` | Nano Banana Pro (Thinking Mode) |

## 보안

- API 키는 브라우저의 localStorage에 **AES-256-GCM으로 암호화**되어 저장됩니다
- 암호화 키는 브라우저 핑거프린트 기반으로 동적 생성됩니다
- API 키는 외부 서버로 전송되지 않으며 오직 Gemini API 호출에만 사용됩니다

## 기여하기

이슈 및 PR 환영합니다!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 참고 자료

- [Gemini API 공식 문서](https://ai.google.dev/gemini-api/docs)
- [Nano Banana Pro](https://ai.google.dev/gemini-api/docs/nanobanana)
- [프로젝트 기획서](docs/PROJECT_PLAN.md)
