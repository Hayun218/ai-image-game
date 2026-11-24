# AI or Human?

행사장 모니터 1대(노트북 연결)에서 진행하는 이미지 판별 게임입니다.
좌우 두 장의 사진 중 **AI가 생성한 사진**을 고르고, 5라운드 중 4개 이상 맞히면 PASS.

- 사진 600쌍(인물·풍경·음식·건축·동물·일상 각 100쌍)이 들어 있습니다.
- 노트북 안에서만 동작합니다. 게임 중에는 인터넷을 쓰지 않습니다.
- 모니터 크기·비율에 맞춰 화면이 자동으로 조정됩니다.

## 바로 실행하기 (설치 없음)

행사 노트북에서는 아래 묶음 하나만 받으면 됩니다. Node·npm·git 설치가 필요 없고, 받은 뒤에는 인터넷도 필요 없습니다.

| 노트북 | 받기 | 실행 |
| --- | --- | --- |
| Windows 10/11 (64비트) | [ai-or-human-win.zip](https://github.com/Hayun218/ai-image-game/releases/latest/download/ai-or-human-win.zip) (약 300MB) | 압축을 풀고 `start.bat` 더블클릭 |
| Mac (Apple Silicon·Intel) | [ai-or-human-mac.zip](https://github.com/Hayun218/ai-image-game/releases/latest/download/ai-or-human-mac.zip) (약 350MB) | 압축을 풀고, 터미널에서 `bash ` 뒤에 `start.command` 를 끌어다 놓고 Enter |

3초 뒤 브라우저가 http://localhost:3000 을 엽니다. `F` 로 전체화면. 실행 창은 행사 내내 켜 두고, 끝낼 때 닫습니다.

- 처음 실행할 때 보안 경고가 뜨면: Windows 는 [추가 정보] → [실행], Mac 은 시스템 설정 → 개인정보 보호 및 보안 → [그래도 열기]
- Windows 방화벽 창이 뜨면 [취소] 를 눌러도 됩니다 (이 노트북 안에서만 접속합니다)
- Mac 은 한 번 실행한 뒤부터 `start.command` 더블클릭으로도 됩니다

**지원하지 않는 환경**: ARM 기반 Windows(확인 안 됨), 32비트 Windows, Windows 7·8, Linux, 태블릿·휴대폰.
회사·학교에서 관리하는 노트북은 보안 정책이 실행을 막을 수 있습니다.

**검증 범위**: Windows 용 묶음은 Windows 11 에서 실행을 확인했습니다. Mac 용 묶음은 실제 Mac 에서
실행해 보지 못했습니다. 어느 쪽이든 행사에 쓸 노트북에서 미리 한 번 실행해 보세요.

## 조작

| 화면 | 입력 |
| --- | --- |
| 시작 | Enter / Space / → / PageDown / [시작하기] 클릭 |
| 라운드 | ← 또는 PageUp = 왼쪽, → 또는 PageDown = 오른쪽, 사진 클릭 (프레젠터 리모컨 가능) |
| 결과 | Enter / Space / PageDown / [다시하기] (결과가 뜬 뒤 1.5초간은 입력 무시) |
| 공통 | `F` = 전체화면 전환, `T` = 다크/라이트 전환 |

- 결과 화면에서 60초간 입력이 없으면 시작 화면으로 돌아갑니다. 라운드 중에는 타임아웃이 없습니다.
- PASS 화면에는 6자리 코드가 표시됩니다 (스태프 확인용).
- **다크/라이트**: 기본은 다크입니다. `T` 키(한글 입력 상태에서도 됨) 또는 상단 바 오른쪽 버튼으로 바꾸고,
  선택은 브라우저에 저장됩니다. 밝은 행사장이면 라이트가 보기 편합니다.
- **화면 크기**: 16:9, 4:3, 울트라와이드, 4K 에 맞춰 자동 조정됩니다. 세로로 세운 모니터에서는 두 사진이
  위아래로 쌓이고, ↑ = 위 사진, ↓ = 아래 사진으로도 고를 수 있습니다.
- 행사 이름·라운드 수·PASS 기준·시간 설정은 `src/config/event.ts` 에서 바꿉니다.

## 동작 방식

- **즉시 표시**: 사진은 노트북 디스크에서 서빙되고, 게임 시작 전에 5쌍(10장)을 전부 디코드해 둡니다.
  다음 게임도 미리 받아 두어 [다시하기] 를 누르면 곧바로 시작됩니다.
- **정답은 서버만 압니다**: 브라우저에는 `/api/img/{해시}` 주소만 내려가고, 어느 쪽이 AI인지는
  답을 고른 뒤에야 알려 줍니다. 채점과 PASS 판정도 서버가 합니다.
- **한 게임 5라운드는 서로 다른 카테고리**에서 나옵니다.
- **재사용**: 풀은 "바퀴" 단위로 돕니다. 한 바퀴 안에서는 같은 쌍이 두 번 나오지 않고, 모든 쌍이 한 번씩
  나가면 전체를 다시 섞어 새 바퀴를 시작합니다. 직전 게임에 나온 쌍은 뒤로 미룹니다.
  600쌍이면 120게임에 한 바퀴입니다. 쌍이 5개 이상만 있으면 게임이 멈추지 않습니다.
- **서버를 다시 켜면** 바퀴 순서와 쌍별 정답률은 초기화됩니다 (메모리에만 보관).

## 개발 환경에서 실행

Node 22 이상이 필요합니다. 풀(`data/images`, `data/pool.json`)이 저장소에 들어 있어 clone 후 바로 실행됩니다.

```bash
git clone https://github.com/Hayun218/ai-image-game.git
cd ai-image-game
npm ci
npm run build
npm start            # http://localhost:3000
```

Windows PowerShell 에서 `npm` 이 실행 정책 오류를 내면 `npm.cmd` 로 바꿔 실행합니다 (예: `npm.cmd ci`).

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드 / 실행 |
| `npm test` / `npm run typecheck` / `npm run lint` | 단위 테스트 / 타입 검사 / 린트 |
| `node scripts/e2e/play.mjs` | 실행 중인 서버에 붙어 게임을 끝까지 플레이하는 E2E 점검 |
| `npm run bundle` | 행사 노트북용 실행 묶음 만들기 (Windows·Mac) |
| `npm run pool:embed` / `pool:pair` / `pool:write` | 행사용 풀 만들기 (아래 참고) |
| `npm run samples` | 개발용 샘플 풀 받기 (15쌍, Commons) |
| `npm run check:secrets` | 스테이징된 파일의 비밀값 검사 (`-- --all` 로 전체) |

E2E 예시: `node scripts/e2e/play.mjs --games 3 --perfect data/pool.json --theme light --width 1024 --height 768 --shots out/e2e`

환경변수는 필요 없습니다. 선택으로 `DATA_DIR`(풀 폴더, 기본 `./data`), `PORT`(기본 3000)를 줄 수 있습니다.

> **public repo 입니다.** 비밀값(`.env*`)은 커밋하지 않습니다. 커밋 전에 `npm run check:secrets` 를 실행하세요.
> `data/pool.json` 에는 정답(어느 쪽이 AI인지)이 들어 있습니다. 풀 작업용 파일(`data/build` 등)은 커밋하지 않습니다.

## 실행 묶음 만들기와 배포

개발 PC(Windows)에서 묶음을 만들어 GitHub Release 에 올리면, 맨 위의 다운로드 링크가 최신 묶음을 가리킵니다.

```bash
npm run bundle           # Windows 용과 Mac 용을 함께 생성 (out/ai-or-human-win.zip, out/ai-or-human-mac.zip)
npm run bundle -- win    # Windows 용만
npm run bundle -- mac    # Mac 용만

# 저장소 소유 계정으로 gh auth login 이 되어 있어야 함
gh release create v1.0.1 out/ai-or-human-win.zip out/ai-or-human-mac.zip --target main --title "AI or Human? v1.0.1" --notes "변경 내용"
```

- 묶음에는 빌드된 서버(Next.js standalone), Node 실행 파일, 게임 풀이 들어 있습니다.
- Windows 용은 개발 PC 의 `node.exe` 를 복사합니다. Mac 용은 nodejs.org 에서 같은 버전의 Apple Silicon·Intel 용
  Node 를 받아 SHA-256 을 확인한 뒤 넣고, 실행할 때 자동으로 골라 씁니다.
- 풀이나 코드를 고치면 묶음을 다시 만들어 새 Release 로 올려야 반영됩니다.

## 사진 풀

### 사진 기준

**실제 사진처럼 보이는 것만** 씁니다. 한눈에 AI 인지 보이면 게임이 안 됩니다.

- AI 이미지: 사진풍(photorealistic)만. 일러스트, 애니, 회화풍, 픽셀아트, 3D 렌더, 판타지/초현실 장면은 제외
- 흑백·세피아, 과한 채도처럼 한쪽만 튀는 색감은 제외 (두 장의 톤이 비슷해야 함)
- 글자, 로고, 워터마크가 보이는 사진은 제외 (AI 글자 뭉개짐이 정답 힌트가 됨)
- 쌍은 같은 카테고리에서 주제·구도가 비슷한 것끼리 맞춘다

현재 풀은 190px 크기의 시트로 검수했기 때문에, 작은 워터마크나 작은 글자가 남아 있을 수 있습니다.
발견하면 아래 "검수" 방법으로 빼고 다시 내보냅니다.

### 풀 만들기 (600쌍)

행사 전에 공개 데이터셋에서 이미지를 미리 받아 `data/` 에 풀을 만들어 두고, 게임은 그 폴더만 읽습니다.
유료 API 는 쓰지 않고, 이미지 분석은 CLIP 모델을 이 PC 의 CPU 로 돌립니다 (처음 한 번 모델 약 350MB 를 받음).

```
[수집]  collect.mjs / collect-commons.mjs   Hugging Face 데이터셋, Wikimedia Commons → data/build/cand/
[임베딩] embed.mjs                           CLIP 으로 이미지마다 512차원 벡터 계산
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
# 5) 게임 풀로 내보내기 → 서버 재시작 (또는 묶음 다시 만들기)
npm run pool:write
```

- 카테고리: 인물(people)·풍경(landscape)·음식(food)·건축(architecture)·동물(animal)·일상(daily), 각 100쌍
- 걸러내는 기준(`pair.mjs` 위쪽 상수): 사진풍 확률, 카테고리 확률, 짝의 최소 유사도, 흑백 제외, 중복 제외
- 후보 원본(`data/build/cand`, 약 18,000장)과 제외 목록(`data/build/drop.txt`)은 작업한 PC 에만 있고 저장소에는 없습니다.
  다른 PC 에서 풀을 다시 만들려면 1) 수집부터 해야 합니다
- Commons 는 요청 제한(429)이 잦아 수집이 느립니다. 서버가 요구하는 시간만큼 기다렸다가 이어서 받습니다

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
사진 한 장 한 장의 권리를 보장하지는 않습니다. 권리자의 요청이 있으면 해당 사진을 풀에서 뺍니다.
촬영자가 확인된 사진만 쓰려면 실제 사진을 Commons 출처(`commons__*`)로 제한하면 됩니다.

### 개발용 샘플 풀

Wikimedia Commons 의 파일로 만든 작은 풀(15쌍)입니다. 풀 형식이나 화면을 빠르게 시험할 때 씁니다.

```bash
npm run samples
```

주의: 이 명령은 `data/pool.json` 을 샘플 15쌍으로 덮어씁니다. 행사용 풀로 되돌리려면
`git checkout data/pool.json` 을 실행하세요.

## 구조

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- 저장: 로컬 폴더의 이미지 파일 + `pool.json`. 게임 상태는 서버 메모리 (데이터베이스 없음)

```
src/
  app/
    page.tsx                       게임 화면
    api/game/{start,answer,finish,replace}/route.ts
    api/img/[hash]/route.ts        data/images 의 사진 서빙 (AI/실제 구분 없이 해시 이름)
  components/game/                 시작 · 라운드 · 결과 화면, 이미지 미리 받기
  config/event.ts                  행사 이름과 게임 규칙
  lib/server/game.ts               게임 세션, 채점
  lib/server/pool/                 풀 읽기, 쌍 선택 · 재사용
scripts/
  build-pool/                      행사용 풀 만들기 (수집 → 임베딩 → 짝짓기 → 검수 → 적용)
  bundle.mjs                       실행 묶음 만들기
  e2e/play.mjs                     E2E 점검
  samples/                         개발용 샘플 풀
data/images/*.webp, data/pool.json 게임이 읽는 풀 (커밋됨)
data/build/, data/.cache/          풀 작업용 (gitignore)
```

`AGENTS.md` 는 코딩 에이전트용 안내입니다 (이 프로젝트의 Next.js 는 버전이 새로워 내장 문서를 먼저 읽으라는 내용).

## 현장 체크리스트

행사 전

- [ ] 행사에 쓸 노트북에서 묶음을 받아 실행해 본다 (보안 경고, 백신, 회사 보안 정책 확인)
- [ ] 행사 모니터에 연결해 `F` 전체화면으로 화면이 잘리지 않는지 본다
- [ ] 조명에 맞춰 다크/라이트(`T`)를 고른다
- [ ] 프레젠터 리모컨을 쓸 경우 ←/→ (또는 PageUp/PageDown)가 먹는지 확인한다
- [ ] 노트북 절전·화면 보호기·자동 업데이트 재시작을 끈다
- [ ] 10게임 정도 플레이하며 티 나는 쌍이 있는지 본다

행사 중

- 실행 창(검은 창/터미널)을 닫지 않는다. 닫았으면 다시 실행하면 된다
- 화면이 멈추거나 "잠시 문제가 생겼어요" 가 뜨면 Enter, 그래도 안 되면 브라우저 새로고침(F5)
- 3000번 포트가 사용 중이라 실행이 안 되면, 이미 떠 있는 실행 창이 있는지 확인한다

## 아직 없는 것

- 관리자 화면(쌍 검수·통계)과 쌍별 정답률의 영구 저장: 지금은 서버를 끄면 통계가 사라집니다
- 행사 중 자동 보충: 풀은 행사 전에 만들어 둔 것만 씁니다 (재사용으로 충분)
- 여러 기기 동시 접속이나 인터넷 배포: 노트북 1대에서 로컬로 실행하는 것을 전제로 합니다
