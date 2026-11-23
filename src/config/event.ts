// 행사 정보와 게임 규칙. 행사가 바뀌면 이 파일만 고친다.

export const EVENT = {
  tagline: "AI-NATIVE UNIVERSITY",
  name: "2026 POSTECH AX 성과공유회",
} as const;

export const GAME = {
  /** 한 게임의 라운드 수 */
  rounds: 5,
  /** PASS 기준 (이상) */
  passScore: 4,
  /** 정답 공개 화면 유지 시간 */
  revealMs: 2000,
  /** 결과 화면에서 입력이 없으면 시작 화면으로 돌아가는 시간 */
  resultIdleMs: 60_000,
  /** 결과 화면이 뜬 직후 입력을 무시하는 시간 (앞 사람이 연타해서 넘어가는 것 방지) */
  resultInputLockMs: 1500,
  /** 이미지 로드 실패 시 예비 쌍 요청 최대 횟수 (라운드당) */
  maxReplacePerRound: 3,
} as const;

/** 미리 받아 둔 게임이 이 시간보다 오래되면 버리고 새로 받는다 (서버 게임 TTL 1시간보다 짧게) */
export const PREFETCH_MAX_AGE_MS = 30 * 60_000;
