# AI or Human?

행사장 모니터 1대(노트북 연결)에서 진행하는 이미지 판별 게임입니다.
좌우 두 장의 사진 중 **AI가 생성한 사진**을 고르고, 5라운드 중 4개 이상 맞히면 PASS.

- **오프라인 우선**: 게임은 노트북에서 로컬로 실행되고, 인터넷이 없어도 끝까지 플레이할 수 있습니다.
  인터넷은 행사 전에 사진 풀을 만들 때와, (선택) 행사 중 자동 보충에만 씁니다.
- **즉시 표시**: 사진은 노트북 디스크에서 서빙되고, 게임 시작 전에 5쌍(10장)을 전부 디코드해 둡니다.
- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- 저장: 로컬 폴더(`data/`)의 이미지 파일 + SQLite(`node:sqlite`, 네이티브 모듈 없음)
- 사진 출처: 공개 데이터셋(Hugging Face)과 Wikimedia Commons 에서 미리 받아 둔 로컬 풀. 쌍 매칭은 로컬 CLIP (유료 API 없음)

> **public repo 입니다.** 비밀값(`.env*`)은 절대 커밋하지 않습니다. 커밋 전에 `npm run check:secrets` 를 실행하세요.
> 게임이 읽는 풀(`data/images`, `data/pool.json`)은 저장소에 포함되어 있어서, 받아서 설치하면 바로 실행됩니다.
> `data/pool.json` 에는 정답(어느 쪽이 AI인지)이 들어 있습니다. 풀 작업용 파일(`data/build` 등)은 커밋하지 않습니다.
> 사진의 출처와 라이선스는 아래 [사진 출처](#사진-출처) 를 보세요.

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

브라우저에서 http://localhost:3000 을 열고 `F` 키(또는 F11)로 전체화면으로 전환합니다.
관리자 페이지는 http://localhost:3000/admin 입니다 (비밀번호: `ADMIN_PASSWORD`).

### 조작

| 화면 | 입력 |
| --- | --- |
| 시작 | Enter / Space / → / PageDown / [시작하기] 클릭 |
| 라운드 | ← 또는 PageUp = 왼쪽, → 또는 PageDown = 오른쪽, 사진 클릭 (프레젠터 리모컨 가능) |
| 결과 | Enter / Space / PageDown / [다시하기] (결과가 뜬 뒤 1.5초간은 입력 무시) |
| 공통 | `F` = 전체화면 전환, `T` = 다크/라이트 전환 |

결과 화면에서 60초간 입력이 없으면 시작 화면으로 돌아갑니다. 라운드 중에는 타임아웃이 없습니다.

### 다크 / 라이트 모드

기본은 다크입니다. `T` 키(한글 입력 상태에서도 됨) 또는 상단 바 오른쪽의 ☀/☾ 버튼으로 바꿉니다.
선택은 브라우저(localStorage)에 저장되어 다시 켜도 유지됩니다. 밝은 행사장이면 라이트가 보기 편합니다.

### 사진 기준 (실사만)

샘플 풀과 행사용 풀 모두 **실제 사진처럼 보이는 것만** 씁니다. 한눈에 AI 인지 보이면 게임이 안 됩니다.

- AI 이미지: 사진풍(photorealistic)만. 일러스트, 애니, 회화풍, 픽셀아트, 3D 렌더, 판타지/초현실 장면은 제외
- 세피아·흑백·빈티지 필터, 과한 채도/HDR 처럼 한쪽만 튀는 색감은 제외 (두 장의 톤이 비슷해야 함)
- 글자, 번호판, 로고, 워터마크가 보이는 사진은 제외 (AI 글자 뭉개짐이 정답 힌트가 됨)
- 쌍은 같은 주제·비슷한 구도로 맞춘다 (예: 고양이 클로즈업 ↔ 고양이 클로즈업)

### 쌍이 다 나가면 (재사용)

풀은 "바퀴" 단위로 돕니다. 한 바퀴 안에서는 같은 쌍이 두 번 나오지 않고, 모든 쌍이 한 번씩 나가면
전체를 다시 섞어서 새 바퀴를 시작합니다. 그래서 승인된 쌍이 5개 이상만 있으면 게임이 멈추지 않습니다.
바로 직전 게임에 나온 쌍은 뒤로 미뤄서, 연달아 같은 사진이 나오는 일을 줄입니다.
(바퀴 상태는 서버 메모리에만 있어서 서버를 다시 켜면 새로 섞습니다.)

### 행사용 풀 만들기 (600쌍)

게임은 실행 중에 외부 API 를 부르지 않습니다. 행사 전에 공개 데이터셋에서 이미지를 미리 받아
이 노트북의 `data/` 에 풀을 만들어 두고, 게임은 그 폴더만 읽습니다. 유료 API 는 쓰지 않습니다.

```
[수집]  collect.mjs / collect-commons.mjs   Hugging Face 데이터셋, Wikimedia Commons → data/build/cand/
[임베딩] embed.mjs                           CLIP(로컬 CPU)으로 이미지마다 512차원 벡터 계산
[짝짓기] pair.mjs                            사진풍만 남김 → 6개 카테고리 분류 → AI ↔ 실제를 비슷한 것끼리 묶음
[검수]  sheet.mjs / drop.mjs                 시트로 훑어보고 티 나는 이미지를 제외 목록에 추가
[적용]  pair.mjs --write                     data/images/*.webp + data/pool.json (게임이 읽는 파일)
```

```bash
# 1) 후보 수집 (이어받기 가능. 예시)
node scripts/build-pool/collect.mjs --ds julienlucas/midjourney-dalle-sd-nanobananapro-dataset
node scripts/build-pool/collect.mjs --ds Photoroom/midjourney-v6-recap --step 30 --max 4000 --only "photograph|photo "
node scripts/build-pool/collect-commons.mjs          # 실제 사진 보충 (Quality images)
# 2) 임베딩 → 3) 짝짓기 (data/build/pairs.json)
npm run pool:embed
npm run pool:pair
# 4) 검수: 시트를 보고 뺄 것을 지정한 뒤 다시 짝짓기
node scripts/build-pool/sheet.mjs --cat food --count 40 --cols 5 --cell 190 --out out/food.png
node scripts/build-pool/drop.mjs a12 h40 b7           # 12번 쌍의 AI, 40번 쌍의 실제 사진, 7번 쌍 양쪽 제외
# 5) 게임 풀로 내보내기 → 서버 재시작
npm run pool:write
```

- 카테고리: 인물(people)·풍경(landscape)·음식(food)·건축(architecture)·동물(animal)·일상(daily), 각 100쌍
- 걸러내는 기준(`pair.mjs` 위쪽 상수): 사진풍 확률, 카테고리 확률, 짝의 최소 유사도, 흑백 제외, 중복 제외
- 한 게임 5라운드는 서로 다른 카테고리에서 나옵니다 (풀의 `topic` = 카테고리)
- 만든 풀(`data/images`, `data/pool.json`)은 저장소에 커밋되어 있어 다른 노트북에서는 clone 만 하면 됩니다
  (`data/build` 는 작업용이라 커밋하지 않음)
- 샘플 풀로 되돌리기: `npm run samples` (행사용 풀을 처음 쓸 때 기존 풀은 `data/pool.samples.json` 으로 백업됨)

### 사진 출처

풀의 600쌍(1,200장)은 아래 공개 자료에서 받아 1:1 로 자르고 1600px webp 로 변환한 것입니다.
쌍마다의 출처는 `data/pool.json` 의 `credit` 에 들어 있고, 게임의 정답 공개 화면에도 표시됩니다.

| 구분 | 출처 | 수 | 라이선스 (출처 표기 기준) |
| --- | --- | --- | --- |
| AI | [ash12321/flux-1-dev-generated-10k](https://huggingface.co/datasets/ash12321/flux-1-dev-generated-10k) (FLUX.1 dev) | 312 | 데이터셋 카드에 표기 없음 |
| AI | [Photoroom/midjourney-v6-recap](https://huggingface.co/datasets/Photoroom/midjourney-v6-recap) (Midjourney v6) | 236 | MIT |
| AI | [julienlucas/midjourney-dalle-sd-nanobananapro-dataset](https://huggingface.co/datasets/julienlucas/midjourney-dalle-sd-nanobananapro-dataset) 의 fake 라벨 | 50 | MIT |
| AI | [tellif/ai_vs_real_image_semantically_similar](https://huggingface.co/datasets/tellif/ai_vs_real_image_semantically_similar) | 2 | 표기 없음 |
| 실제 | [Wikimedia Commons](https://commons.wikimedia.org/) Quality images | 316 | 사진별 CC BY / CC BY-SA / 퍼블릭 도메인. 촬영자·라이선스·원본 링크가 `pool.json` 에 있음 |
| 실제 | julienlucas 데이터셋의 real 라벨 | 284 | MIT (데이터셋 전체에 대한 표기) |

알아둘 점: julienlucas 데이터셋은 실제 사진을 어디서 가져왔는지와 촬영자를 기록하지 않아서,
이 284장은 데이터셋 이름까지만 표기할 수 있습니다. 데이터셋의 MIT 표기는 묶음에 대한 것이고
사진 한 장 한 장의 권리를 보장하지는 않습니다. 권리자의 요청이 있으면 해당 사진을 풀에서 뺍니다
(`data/build/drop.txt` 에 추가 후 `npm run pool:write`). 촬영자가 확인된 사진만 쓰려면 실제 사진을
Commons 출처(`commons__*`)로 제한하면 됩니다.

### 개발용 샘플 풀

실제 풀(5단계)이 준비되기 전에는 Wikimedia Commons 의 샘플 15쌍으로 플레이할 수 있습니다.
AI 이미지와 실제 사진 모두 Commons 에 올라온 진짜 파일(퍼블릭 도메인/CC)이며, `data/` 에만 저장됩니다.

```bash
npm run samples
```

주의: 이 명령은 `data/pool.json` 을 샘플 15쌍으로 덮어씁니다. 행사용 풀로 되돌리려면
`git checkout data/pool.json` 을 실행하세요.

Commons 가 요청을 제한하면(429) 서버가 요구하는 시간만큼 기다렸다가 이어서 받습니다.

개발 중에는 `npm run dev` 를 씁니다.

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 (행사 때는 이것) |
| `npm run lint` / `npm run typecheck` / `npm test` | 린트 / 타입 검사 / 단위 테스트 |
| `npm run samples` | 개발용 샘플 풀 받기 (Commons) |
| `npm run check:secrets` | 스테이징된 파일의 비밀값 검사 (`-- --all` 로 전체) |

## 환경변수

| 이름 | 필요 시점 | 설명 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 항상 | `/admin`, `/api/admin/*` Basic Auth 비밀번호 |
| `DATA_DIR` | 선택 | 사진·DB 폴더. 기본 `./data` |
| `FREEPIK_API_KEY` | 풀 생성 / 자동 보충 | Freepik API 키 |
| `ANTHROPIC_API_KEY` | 풀 생성 / 자동 보충 | 쌍 매칭·품질 검사 |
| `AUTO_PULL` | 선택 | 온라인일 때 남은 쌍이 적으면 자동 보충 (기본 `on`, `off` 로 끔) |
| `AUTO_PULL_LOW_WATERMARK` | 선택 | 자동 보충 기준 (아직 안 나간 쌍 수, 기본 300) |

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
data/images/*.webp, data/pool.json   게임이 읽는 풀 (커밋됨)
data/build/, data/.cache/            풀 작업용 (gitignore)
```

## 현장 운영 체크리스트

6단계에서 추가합니다.
