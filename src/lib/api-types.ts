// 클라이언트 ↔ 서버 API 타입. 정답(aiSide)은 answer 응답에서만 내려간다.

export type Side = "L" | "R";

export interface Credit {
  /** 촬영자/제작자 이름 */
  name: string;
  /** 원본 페이지 링크 */
  link: string;
  /** 출처 (예: "Freepik", "Wikimedia Commons") */
  source: string;
  /** 라이선스 표기 (예: "CC BY-SA 4.0"). 없으면 생략 */
  license?: string;
}

export interface RoundImages {
  left: { src: string };
  right: { src: string };
}

export interface StartResponse {
  gameId: string;
  rounds: RoundImages[];
}

export interface ReplaceRequest {
  gameId: string;
  round: number;
}
export type ReplaceResponse = RoundImages;

export interface AnswerRequest {
  gameId: string;
  round: number;
  choice: Side;
}
export interface AnswerResponse {
  correct: boolean;
  aiSide: Side;
  credit: { left: Credit | null; right: Credit | null };
}

export interface FinishRequest {
  gameId: string;
}
export interface FinishResponse {
  passed: boolean;
  score: number;
  total: number;
  /** 게임 ID 앞 6자리 (대문자) — PASS 화면 캡처 재사용 방지 */
  code: string;
}

export interface ApiError {
  error: string;
}
