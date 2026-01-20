# Image Translator

Gemini AI 기반 이미지 OCR 및 번역 웹 서비스

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

## 데모

**Live Demo**: http://141.148.168.113:3003

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

| 영역 | 기술 |
|------|------|
| **Frontend** | React 18 + TypeScript |
| **Build Tool** | Vite 7.x |
| **Styling** | Tailwind CSS 4.x |
| **State Management** | Zustand |
| **AI API** | Google Gemini API (@google/generative-ai) |
| **Encryption** | Web Crypto API (AES-256-GCM) |
| **Deployment** | Docker + Nginx |

## 시작하기

### 요구사항

- Node.js 20.x 이상
- npm 또는 yarn
- Gemini API Key ([Google AI Studio](https://aistudio.google.com/apikey)에서 무료 발급)

### 로컬 개발

```bash
# 저장소 클론
git clone https://github.com/tomtomjskim/image-translator.git
cd image-translator

# 의존성 설치
npm install

# 개발 서버 시작
npm run dev
```

### Docker 배포

```bash
# 이미지 빌드
docker build -t image-translator .

# 컨테이너 실행
docker run -d -p 3003:80 --name image-translator image-translator
```

### Docker Compose (권장)

```yaml
services:
  image-translator:
    build:
      context: ./image-translator
      dockerfile: Dockerfile
    container_name: image-translator
    restart: always
    ports:
      - "3003:80"
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://127.0.0.1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## 사용 방법

1. **API Key 설정**: 오른쪽 상단의 "API Key 필요" 버튼 클릭 → Gemini API Key 입력
2. **언어 설정**: 소스 언어(자동감지 권장)와 타겟 언어 선택
3. **이미지 업로드**: 드래그앤드롭, 파일 선택, URL 입력 중 원하는 방식으로 이미지 추가
4. **번역 실행**: "번역" 버튼 클릭
5. **결과 확인**: 원문과 번역문 확인 후 복사 또는 JSON 내보내기

## 프로젝트 구조

```
image-translator/
├── docs/
│   └── PROJECT_PLAN.md      # 프로젝트 기획서
├── src/
│   ├── components/          # React 컴포넌트
│   │   ├── common/          # 공통 UI (Button, Modal)
│   │   ├── ApiKeyManager    # API 키 관리
│   │   ├── ImageUploader    # 이미지 업로드
│   │   ├── LanguageSelector # 언어 선택
│   │   └── TranslationResult# 번역 결과
│   ├── services/            # 비즈니스 로직
│   │   ├── gemini.ts        # Gemini API 연동
│   │   └── crypto.ts        # 암호화/복호화
│   ├── stores/              # Zustand 상태 관리
│   ├── hooks/               # Custom Hooks
│   ├── types/               # TypeScript 타입 정의
│   └── utils/               # 유틸리티 함수
├── Dockerfile               # Docker 빌드 설정
├── nginx.conf               # Nginx SPA 설정
└── README.md
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
- 별도의 백엔드 서버 없이 클라이언트에서 직접 API 호출

## 배포 정보

| 환경 | URL | 상태 |
|------|-----|------|
| Production | http://141.148.168.113:3003 | ![Status](https://img.shields.io/badge/status-online-success) |

### 인프라 구성

```
nginx-proxy (:3003) → image-translator (172.20.0.18:80)
```

## 향후 계획 (v2.0)

- [ ] Nano Banana Pro를 활용한 번역 이미지 자동 생성
- [ ] 번역 히스토리 저장 (IndexedDB)
- [ ] 번역 메모리/용어집 기능
- [ ] Chrome Extension 버전
- [ ] 다중 이미지 일괄 처리 개선

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

---

*Built with Gemini AI & React*
