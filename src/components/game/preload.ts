import { GAME } from "@/config/event";
import type { ApiError, ReplaceResponse, RoundImages, StartResponse } from "@/lib/api-types";

export interface LoadedRound {
  left: HTMLImageElement;
  right: HTMLImageElement;
}

export interface LoadedGame {
  gameId: string;
  rounds: LoadedRound[];
  fetchedAt: number;
}

const IMAGE_TIMEOUT_MS = 15_000;

export async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T | ApiError;
  if (!res.ok) throw new Error((data as ApiError).error || `HTTP ${res.status}`);
  return data as T;
}

/** 이미지를 받아서 디코드까지 끝낸 <img> 요소를 돌려준다. 화면에 붙이면 즉시 그려진다. */
function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.draggable = false;
  img.alt = "";
  img.className = "block h-full w-full object-cover";
  img.src = src;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout: ${src}`)), IMAGE_TIMEOUT_MS);
  });
  return Promise.race([img.decode().then(() => img), timeout]).finally(() => clearTimeout(timer));
}

async function loadRound(
  gameId: string,
  round: number,
  imgs: RoundImages,
  replacedSoFar: number,
): Promise<LoadedRound> {
  for (let attempt = replacedSoFar; ; attempt++) {
    try {
      const [left, right] = await Promise.all([loadImage(imgs.left.src), loadImage(imgs.right.src)]);
      return { left, right };
    } catch (e) {
      if (attempt >= GAME.maxReplacePerRound) throw e;
      console.warn(`round ${round + 1} 이미지 실패, 예비 쌍으로 교체`, e);
      imgs = await post<ReplaceResponse>("/api/game/replace", { gameId, round });
    }
  }
}

/** 새 게임을 시작하고 5쌍(10장)을 전부 디코드한 뒤에 돌려준다. */
export async function loadGame(): Promise<LoadedGame> {
  const start = await post<StartResponse>("/api/game/start");
  // 교체 요청끼리 주제가 겹치지 않도록 라운드는 순서대로 확정하되, 이미지 다운로드는 먼저 전부 시작해 둔다.
  const first = start.rounds.map((r) => [loadImage(r.left.src), loadImage(r.right.src)] as const);
  // 아직 await 하지 않은 라운드의 실패가 unhandled rejection 이 되지 않게
  first.flat().forEach((p) => p.catch(() => {}));
  const rounds: LoadedRound[] = [];
  for (let i = 0; i < start.rounds.length; i++) {
    try {
      const [left, right] = await Promise.all(first[i]);
      rounds.push({ left, right });
    } catch {
      const imgs = await post<ReplaceResponse>("/api/game/replace", { gameId: start.gameId, round: i });
      rounds.push(await loadRound(start.gameId, i, imgs, 1));
    }
  }
  return { gameId: start.gameId, rounds, fetchedAt: Date.now() };
}
