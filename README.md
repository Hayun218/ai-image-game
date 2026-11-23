# AI or Human?

행사장 모니터 1대(노트북 연결)에서 진행하는 이미지 판별 게임입니다.
좌우 두 장의 사진 중 **AI가 생성한 사진**을 고르고, 5라운드 중 4개 이상 맞히면 PASS.

- **오프라인 우선**: 게임은 노트북에서 로컬로 실행되고, 인터넷이 없어도 끝까지 플레이할 수 있습니다.
  인터넷은 행사 전에 사진 풀을 만들 때와, (선택) 행사 중 자동 보충에만 씁니다.
- **즉시 표시**: 사진은 노트북 디스크에서 서빙되고, 게임 시작 전에 5쌍(10장)을 전부 디코드해 둡니다.
- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- 저장: 로컬 폴더(`data/`)의 이미지 파일 + SQLite(`node:sqlite`, 네이티브 모듈 없음)
- 사진 출처: Freepik API (AI 이미지 / 실제 사진), 쌍 매칭·검사: Anthropic API

> **public repo 입니다.** 비밀값, 사진, 쌍(pair) 데이터는 절대 커밋하지 않습니다.
> 사진과 쌍 데이터는 `data/`(gitignore 됨)에만 둡니다. 커밋 전에 `npm run check:secrets` 를 실행하세요.

## 설치 (행사 노트북)

Node 22 이상이 필요합니다.

```bash
npm ci
cp .env.example .env.local   # 값 채우기
npm run build
```

## 실행

```bash
npm start
```

브라우저에서 http://localhost:3000 을 열고 전체화면(F11)으로 전환합니다.
관리자 페이지는 http://localhost:3000/admin 입니다 (비밀번호: `ADMIN_PASSWORD`).

개발 중에는 `npm run dev` 를 씁니다.

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 (행사 때는 이것) |
| `npm run lint` / `npm run typecheck` | 린트 / 타입 검사 |
| `npm run check:secrets` | 스테이징된 파일의 비밀값 검사 (`-- --all` 로 전체) |

## 환경변수

| 이름 | 필요 시점 | 설명 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 항상 | `/admin`, `/api/admin/*` Basic Auth 비밀번호 |
| `DATA_DIR` | 선택 | 사진·DB 폴더. 기본 `./data` |
| `FREEPIK_API_KEY` | 풀 생성 / 자동 보충 | Freepik API 키 |
| `ANTHROPIC_API_KEY` | 풀 생성 / 자동 보충 | 쌍 매칭·품질 검사 |
| `AUTO_PULL` | 선택 | `on` 이면 온라인일 때 남은 쌍이 적으면 자동 보충 (기본 `off`) |
| `AUTO_PULL_LOW_WATERMARK` | 선택 | 자동 보충 기준 (아직 안 나간 쌍 수, 기본 200) |

## 디렉터리 구조 (예정)

```
src/
  app/
    page.tsx                  게임 화면 (시작 → 준비 중 → 라운드 → 결과)
    admin/                    관리자 (대시보드, 검수, 쌍 목록)
    api/game/{start,answer,finish}/route.ts
    api/img/[hash]/route.ts   data/images 의 사진 서빙 (AI/실제 구분 없이 해시 이름)
    api/admin/*
  lib/
    db.ts                     SQLite (data/pool.db)
    pool/                     쌍 선택 · 재사용 · 자동 회수
    game/                     게임 세션, 채점
  proxy.ts                    /admin, /api/admin Basic Auth
  instrumentation.ts          (선택) 자동 보충 백그라운드 작업
config/topics.yaml            주제 이름 + 검색어만
scripts/build-pool/           사진 풀 생성 배치 (행사 전, 온라인)
data/                         ← gitignore. images/*.webp, pool.db
```

## 현장 운영 체크리스트

6단계에서 추가합니다.
