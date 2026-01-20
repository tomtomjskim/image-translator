# Phase 1: HTTPS 설정 상세 구현 가이드

## 문서 정보

| 항목 | 내용 |
|------|------|
| **Phase** | 1 |
| **기능** | HTTPS 설정 |
| **우선순위** | P0 (필수) |
| **예상 소요** | 1-2시간 |
| **상태** | ✅ 완료 |

---

## 1. 목적 및 배경

### 1.1 현재 문제
- 서비스가 HTTP (http://141.148.168.113:3003)로 운영 중
- Web Crypto API (`crypto.subtle`)가 HTTP에서 제한됨
- 브라우저 보안 경고 표시
- API 키가 평문 노출 위험

### 1.2 해결 목표
- HTTPS 적용으로 완전한 보안 구현
- AES-256-GCM 암호화 활성화
- 브라우저 경고 제거

### 1.3 구현 옵션

| 옵션 | 장점 | 단점 | 권장 |
|------|------|------|------|
| **A. 자체 서명 인증서** | 즉시 적용 가능, 도메인 불필요 | 브라우저 경고 발생 | 개발/테스트용 |
| **B. Let's Encrypt** | 무료, 신뢰할 수 있는 인증서 | 도메인 필요 | 운영용 (권장) |
| **C. 유료 인증서** | 확장 검증(EV) 가능 | 비용 발생 | 기업용 |

---

## 2. 옵션 A: 자체 서명 인증서 (즉시 적용)

### 2.1 인증서 생성

```bash
# SSL 디렉토리로 이동
cd /home/ubuntu/nginx/ssl

# 자체 서명 인증서 생성 (10년 유효)
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout selfsigned.key \
    -out selfsigned.crt \
    -subj "/C=KR/ST=Seoul/L=Seoul/O=ImageTranslator/CN=141.148.168.113"

# 권한 설정
chmod 600 selfsigned.key
chmod 644 selfsigned.crt
```

### 2.2 Nginx SSL 설정

```nginx
# /home/ubuntu/nginx/conf.d/ssl-image-translator.conf

# HTTP -> HTTPS 리다이렉트 (포트 3003)
server {
    listen 3003;
    server_name _;

    # GeoIP 차단
    if ($allowed_country = no) {
        return 403;
    }

    # HTTPS로 리다이렉트
    return 301 https://$host:3443$request_uri;
}

# HTTPS 서버 (포트 3443)
server {
    listen 3443 ssl http2;
    server_name _;

    # SSL 인증서
    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;

    # SSL 보안 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # HSTS (자체 서명에서는 주의 필요)
    # add_header Strict-Transport-Security "max-age=63072000" always;

    # GeoIP 차단
    if ($allowed_country = no) {
        return 403;
    }

    # 프록시 설정
    location / {
        limit_req zone=general burst=10 nodelay;

        proxy_pass http://172.20.0.18:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 정적 파일 캐싱
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot|webp)$ {
        proxy_pass http://172.20.0.18:80;
        proxy_cache my_cache;
        proxy_cache_valid 200 1h;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }
}
```

### 2.3 Docker Compose 포트 추가

```yaml
# /home/ubuntu/jsnwcorp-infrastructure/docker-compose.yml
# nginx 서비스에 포트 추가

services:
  nginx:
    ports:
      - "80:80"
      - "443:443"
      - "3001:3001"
      - "3002:3002"
      - "3003:3003"
      - "3443:3443"  # NEW: Image Translator HTTPS
```

### 2.4 적용 명령

```bash
# 1. SSL 인증서 생성
cd /home/ubuntu/nginx/ssl
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout selfsigned.key -out selfsigned.crt \
    -subj "/C=KR/ST=Seoul/L=Seoul/O=ImageTranslator/CN=141.148.168.113"

# 2. Nginx 설정 추가 (별도 파일)
# ssl-image-translator.conf 파일 생성

# 3. Docker 재시작
cd /home/ubuntu/jsnwcorp-infrastructure
docker compose -p ubuntu up -d nginx

# 4. 테스트
curl -k https://141.148.168.113:3443/health
```

---

## 3. 옵션 B: Let's Encrypt (도메인 필요)

### 3.1 사전 요구사항
- 도메인 소유 (예: image-translator.example.com)
- DNS A 레코드가 서버 IP(141.148.168.113)를 가리킴
- 포트 80, 443 방화벽 오픈

### 3.2 Certbot 설치 (Docker 방식)

```bash
# Certbot Docker 이미지로 인증서 발급
docker run -it --rm \
    -v /home/ubuntu/nginx/ssl:/etc/letsencrypt \
    -v /home/ubuntu/nginx/www:/var/www/certbot \
    -p 80:80 \
    certbot/certbot certonly \
    --standalone \
    -d image-translator.example.com \
    --email admin@example.com \
    --agree-tos \
    --no-eff-email
```

### 3.3 Nginx 설정 (Let's Encrypt)

```nginx
# /home/ubuntu/nginx/conf.d/ssl-letsencrypt.conf

# ACME Challenge용 (인증서 갱신)
server {
    listen 80;
    server_name image-translator.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS 서버
server {
    listen 443 ssl http2;
    server_name image-translator.example.com;

    ssl_certificate /etc/nginx/ssl/live/image-translator.example.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/live/image-translator.example.com/privkey.pem;

    # SSL 최적화 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;

    # HSTS 활성화
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    # 프록시 설정
    location / {
        proxy_pass http://172.20.0.18:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3.4 인증서 자동 갱신 (Cron)

```bash
# /etc/cron.d/certbot-renew
0 0 1 * * root docker run --rm \
    -v /home/ubuntu/nginx/ssl:/etc/letsencrypt \
    -v /home/ubuntu/nginx/www:/var/www/certbot \
    certbot/certbot renew --quiet && \
    docker exec nginx-proxy nginx -s reload
```

---

## 4. 파일 변경 목록

### 4.1 신규 파일

| 파일 경로 | 설명 |
|-----------|------|
| `/home/ubuntu/nginx/ssl/selfsigned.crt` | 자체 서명 인증서 |
| `/home/ubuntu/nginx/ssl/selfsigned.key` | 개인 키 |
| `/home/ubuntu/nginx/conf.d/ssl-image-translator.conf` | HTTPS Nginx 설정 |

### 4.2 수정 파일

| 파일 경로 | 변경 내용 |
|-----------|----------|
| `/home/ubuntu/jsnwcorp-infrastructure/docker-compose.yml` | 포트 3443 추가 |
| `/home/ubuntu/nginx/conf.d/port-based.conf` | 기존 3003 → HTTPS 리다이렉트 |

---

## 5. 검증 체크리스트

### 5.1 기능 테스트
- [ ] HTTPS 접속 확인: `https://141.148.168.113:3443`
- [ ] HTTP → HTTPS 리다이렉트 확인
- [ ] SSL 인증서 유효성 확인
- [ ] API 키 저장 기능 테스트 (crypto.subtle 작동 확인)

### 5.2 보안 테스트
```bash
# SSL 테스트
curl -k -I https://141.148.168.113:3443

# 인증서 정보 확인
openssl s_client -connect 141.148.168.113:3443 -servername 141.148.168.113 < /dev/null 2>/dev/null | openssl x509 -text -noout

# SSL Labs 테스트 (도메인 필요)
# https://www.ssllabs.com/ssltest/
```

### 5.3 성능 테스트
- [ ] 페이지 로딩 속도 확인
- [ ] HTTP/2 활성화 확인

---

## 6. 롤백 계획

HTTPS 적용 후 문제 발생 시:

```bash
# 1. SSL 설정 파일 제거
rm /home/ubuntu/nginx/conf.d/ssl-image-translator.conf

# 2. port-based.conf 복원 (필요시)

# 3. Nginx 재시작
docker exec nginx-proxy nginx -s reload

# 4. docker-compose 포트 제거 (필요시)
```

---

## 7. 접속 URL 변경

| 변경 전 | 변경 후 |
|---------|---------|
| http://141.148.168.113:3003 | https://141.148.168.113:3443 |

**참고**: 자체 서명 인증서 사용 시 브라우저에서 "안전하지 않음" 경고가 표시됩니다.
"고급" → "계속 진행" 클릭으로 접속 가능합니다.

---

## 8. 다음 단계

Phase 1 완료 후:
1. 도메인 구매 검토 (Let's Encrypt 적용을 위해)
2. Phase 2 (번역 이미지 생성) 진행
3. README 및 문서 업데이트

---

*문서 버전: 1.0.0*
*최종 수정: 2026-01-20*
