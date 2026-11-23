# AI or Human?

행사장 모니터 1대에서 진행하는 이미지 판별 게임입니다.
좌우 두 장의 사진 중 **AI가 생성한 사진**을 고르고, 5라운드 중 4개 이상 맞히면 PASS.

- 프론트/서버: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- 배포: Netlify (`@netlify/plugin-nextjs`)
- 사진 풀 상태: Upstash Redis · AI 이미지 저장: Netlify Blobs
- 실제 사진: Unsplash API(주) / Pexels API(보조) — hotlink

> **public repo 입니다.** 비밀값, 사진, 쌍(pair) 데이터는 절대 커밋하지 않습니다.
> 커밋 전에 `npm run check:secrets` 를 실행하세요.

## 로컬 실행

```bash
nvm use            # Node 22
npm ci
cp .env.example .env.local   # 필요한 값만 채운다. 비워 두면 mock 풀로 동작
npm run dev
```

브라우저에서 http://localhost:3000 을 열고 전체화면(F11)으로 전환합니다.

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm run lint` / `npm run typecheck` | 린트 / 타입 검사 |
| `npm run check:secrets` | 스테이징된 파일의 비밀값 검사 (`-- --all` 로 전체) |

## Netlify 연결

1. Netlify → **Add new site → Import an existing project → GitHub** 에서 이 저장소 선택.
2. 빌드 설정은 `netlify.toml` 이 자동으로 적용됩니다 (`npm run build`, Node 22, Next.js 플러그인).
3. **Site configuration → Environment variables** 에 아래 "게임 서버" 변수를 등록합니다.
4. Netlify Blobs 는 별도 설정 없이 사이트 단위로 사용됩니다.
   배치(GitHub Actions)에서 업로드하려면 `NETLIFY_SITE_ID`(Site configuration → General → Site ID)와
   `NETLIFY_AUTH_TOKEN`(User settings → Applications → Personal access tokens)이 필요합니다.
5. 배포 후 `/admin` 접속 시 Basic Auth 창이 뜨는지 확인합니다 (사용자명은 아무거나, 비밀번호는 `ADMIN_PASSWORD`).

## 환경변수

| 이름 | 사용처 | 설명 |
| --- | --- | --- |
| `UPSTASH_REDIS_REST_URL` | 서버, 배치 | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | 서버, 배치 | Upstash Redis REST 토큰 |
| `ADMIN_PASSWORD` | 서버 | `/admin`, `/api/admin/*` Basic Auth 비밀번호 |
| `POOL_BACKEND` | 서버 | `mock` 또는 `redis`. 비우면 Redis 변수가 있을 때 `redis`, 없으면 `mock` |
| `UNSPLASH_ACCESS_KEY` | 서버, 배치 | Unsplash API Access Key (서버는 `download_location` 호출에 사용) |
| `PEXELS_API_KEY` | 배치 | Pexels API 키 (보조 소스) |
| `ANTHROPIC_API_KEY` | 배치 | 비전 LLM 점수·캡션·QC |
| `IMAGE_PROVIDER` | 배치 | 이미지 생성 provider 이름 |
| `IMAGE_PROVIDER_API_KEY` | 배치 | 이미지 생성 provider API 키 |
| `NETLIFY_SITE_ID` | 배치 | Blobs 업로드 대상 사이트 |
| `NETLIFY_AUTH_TOKEN` | 배치 | Blobs 업로드용 토큰 |

- 로컬: `.env.local` (gitignore 됨)
- Netlify: 사이트 환경변수
- GitHub Actions: 저장소 Secrets

## 디렉터리 구조 (예정)

```
src/
  app/
    page.tsx                 게임 화면 (시작 → 준비 중 → 라운드 → 결과)
    admin/                   관리자 (대시보드, 검수, 쌍 목록)
    api/game/{start,answer,finish}/route.ts
    api/img/[hash]/route.ts  AI 이미지 서빙 (Blobs)
    api/admin/*              관리자 API
  lib/
    pool/                    풀 인터페이스 + mock / redis 구현
    game/                    게임 세션, 채점
    unsplash.ts              download_location 트래킹
  proxy.ts                   /admin, /api/admin Basic Auth (Next 16의 middleware)
config/topics.yaml           주제 이름 + 검색어만
scripts/build-pool/          사진 풀 생성 배치
.github/workflows/build-pool.yml
```

## 현장 운영 체크리스트

6단계에서 추가합니다.
