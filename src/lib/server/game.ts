import { randomInt, randomUUID } from "node:crypto";
import { GAME } from "@/config/event";
import type {
  AnswerResponse,
  FinishResponse,
  RoundImages,
  Side,
  StartResponse,
} from "@/lib/api-types";
import { getPool, type Pair, type PoolStore } from "./pool";

const GAME_TTL_MS = 60 * 60_000;

interface RoundState {
  pairId: string;
  topic: string;
  aiSide: Side;
  aiHash: string;
  humanHash: string;
  replaceCount: number;
  answer?: { choice: Side; correct: boolean };
}

interface GameState {
  id: string;
  createdAt: number;
  rounds: RoundState[];
  finished?: FinishResponse;
}

export class GameError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// 단일 프로세스(행사 노트북) 전제의 메모리 저장소. dev 의 HMR 에도 유지되도록 globalThis 에 둔다.
const g = globalThis as unknown as { __games?: Map<string, GameState> };
const games = (g.__games ??= new Map());

function sweep(now = Date.now()) {
  for (const [id, s] of games) if (now - s.createdAt > GAME_TTL_MS) games.delete(id);
}

function getGame(gameId: unknown): GameState {
  if (typeof gameId !== "string") throw new GameError(400, "gameId 가 필요합니다");
  const s = games.get(gameId);
  if (!s || Date.now() - s.createdAt > GAME_TTL_MS) throw new GameError(404, "게임이 없거나 만료되었습니다");
  return s;
}

function toRoundState(p: Pair): RoundState {
  return {
    pairId: p.id,
    topic: p.topic,
    aiSide: randomInt(2) === 0 ? "L" : "R",
    aiHash: p.ai.hash,
    humanHash: p.human.hash,
    replaceCount: 0,
  };
}

const imgSrc = (hash: string) => `/api/img/${hash}`;

function toRoundImages(r: RoundState): RoundImages {
  const [l, rt] = r.aiSide === "L" ? [r.aiHash, r.humanHash] : [r.humanHash, r.aiHash];
  return { left: { src: imgSrc(l) }, right: { src: imgSrc(rt) } };
}

export async function startGame(pool?: PoolStore): Promise<StartResponse> {
  sweep();
  pool ??= await getPool();
  const pairs = await pool.draw(GAME.rounds);
  if (pairs.length < GAME.rounds) {
    throw new GameError(503, `사진 쌍이 부족합니다 (${pairs.length}/${GAME.rounds})`);
  }
  const state: GameState = {
    id: randomUUID(),
    createdAt: Date.now(),
    rounds: pairs.map(toRoundState),
  };
  games.set(state.id, state);
  return { gameId: state.id, rounds: state.rounds.map(toRoundImages) };
}

/** 이미지 로드에 실패한 라운드의 쌍을 예비 쌍으로 교체 */
export async function replaceRound(gameId: unknown, round: unknown, pool?: PoolStore): Promise<RoundImages> {
  const s = getGame(gameId);
  const r = s.rounds[checkRound(round, s)];
  if (r.answer) throw new GameError(409, "이미 답한 라운드입니다");
  if (r.replaceCount >= GAME.maxReplacePerRound) throw new GameError(429, "교체 횟수를 초과했습니다");
  pool ??= await getPool();
  const [pair] = await pool.draw(1, {
    excludeTopics: s.rounds.filter((x) => x !== r).map((x) => x.topic),
    excludeIds: s.rounds.map((x) => x.pairId),
  });
  if (!pair) throw new GameError(503, "예비 쌍이 없습니다");
  const next = { ...toRoundState(pair), replaceCount: r.replaceCount + 1 };
  s.rounds[s.rounds.indexOf(r)] = next;
  return toRoundImages(next);
}

export async function answerRound(
  gameId: unknown,
  round: unknown,
  choice: unknown,
  pool?: PoolStore,
): Promise<AnswerResponse> {
  const s = getGame(gameId);
  const idx = checkRound(round, s);
  if (choice !== "L" && choice !== "R") throw new GameError(400, "choice 는 L 또는 R 이어야 합니다");
  const answered = s.rounds.findIndex((r) => !r.answer);
  if (answered === -1 || idx !== answered) throw new GameError(409, "라운드 순서가 맞지 않습니다");

  const r = s.rounds[idx];
  const correct = choice === r.aiSide;
  r.answer = { choice, correct };

  pool ??= await getPool();
  await pool.recordResult(r.pairId, correct);
  const pair = await pool.get(r.pairId);
  const aiCredit = pair?.ai.credit ?? null;
  const humanCredit = pair?.human.credit ?? null;
  return {
    correct,
    aiSide: r.aiSide,
    credit:
      r.aiSide === "L"
        ? { left: aiCredit, right: humanCredit }
        : { left: humanCredit, right: aiCredit },
  };
}

export function finishGame(gameId: unknown): FinishResponse {
  const s = getGame(gameId);
  if (s.finished) return s.finished;
  if (s.rounds.some((r) => !r.answer)) throw new GameError(409, "아직 끝나지 않은 게임입니다");
  const score = s.rounds.filter((r) => r.answer?.correct).length;
  s.finished = {
    passed: score >= GAME.passScore,
    score,
    total: s.rounds.length,
    code: s.id.replace(/-/g, "").slice(0, 6).toUpperCase(),
  };
  return s.finished;
}

function checkRound(round: unknown, s: GameState): number {
  if (typeof round !== "number" || !Number.isInteger(round) || round < 0 || round >= s.rounds.length) {
    throw new GameError(400, "round 값이 올바르지 않습니다");
  }
  return round;
}

/** 테스트용 */
export function __resetGames() {
  games.clear();
}
