import { beforeEach, describe, expect, it } from "vitest";
import { __resetGames, answerRound, finishGame, GameError, replaceRound, startGame } from "./game";
import { MemoryPool } from "./pool/memory";
import { selectPairs } from "./pool/select";
import type { Pair } from "./pool/types";

function pair(id: string, topic: string, extra: Partial<Pair> = {}): Pair {
  return {
    id,
    topic,
    ai: { hash: `a${id}`.padEnd(32, "0"), credit: { name: "ai", link: "x", source: "S" } },
    human: { hash: `h${id}`.padEnd(32, "0"), credit: { name: "hu", link: "y", source: "S" } },
    status: "approved",
    servedCount: 0,
    correctCount: 0,
    lastServedAt: 0,
    ...extra,
  };
}

function makePool(n: number, topics = n) {
  return new MemoryPool(new Map(Array.from({ length: n }, (_, i) => [`p${i}`, pair(`p${i}`, `t${i % topics}`)])));
}

const srcHash = (src: string) => src.replace("/api/img/", "");

beforeEach(() => __resetGames());

describe("startGame", () => {
  it("5라운드를 서로 다른 주제로 내려보내고 정답 정보는 포함하지 않는다", async () => {
    const pool = makePool(10);
    const res = await startGame(pool);
    expect(res.rounds).toHaveLength(5);
    const text = JSON.stringify(res);
    expect(text).not.toMatch(/aiSide|"ai"|human|credit|topic|pair/i);
    for (const r of res.rounds) {
      expect(r.left.src).toMatch(/^\/api\/img\/[a-z0-9]{32}$/);
      expect(r.right.src).toMatch(/^\/api\/img\/[a-z0-9]{32}$/);
    }
  });

  it("쌍이 부족하면 503", async () => {
    await expect(startGame(makePool(3))).rejects.toMatchObject({ status: 503 });
  });
});

describe("answer / finish", () => {
  it("서버가 채점하고 PASS 판정을 계산한다", async () => {
    const pool = makePool(10);
    const { gameId, rounds } = await startGame(pool);
    let score = 0;
    for (let i = 0; i < 5; i++) {
      // 첫 판정으로 aiSide 를 알아낸 다음, 4개만 맞히도록 선택
      const ai = srcHash(rounds[i].left.src).startsWith("a") ? "L" : "R";
      const choice = i === 0 ? (ai === "L" ? "R" : "L") : ai;
      const res = await answerRound(gameId, i, choice, pool);
      expect(res.aiSide).toBe(ai);
      expect(res.correct).toBe(choice === ai);
      if (res.correct) score++;
      // 크레딧이 좌우에 맞게 붙는다
      expect(res.credit[ai === "L" ? "left" : "right"]?.name).toBe("ai");
    }
    const fin = finishGame(gameId);
    expect(fin).toMatchObject({ passed: true, score: 4, total: 5 });
    expect(fin.code).toMatch(/^[0-9A-F]{6}$/);
    expect(score).toBe(4);
  });

  it("3개 이하는 FAIL", async () => {
    const pool = makePool(10);
    const { gameId, rounds } = await startGame(pool);
    for (let i = 0; i < 5; i++) {
      const ai = srcHash(rounds[i].left.src).startsWith("a") ? "L" : "R";
      await answerRound(gameId, i, i < 3 ? ai : ai === "L" ? "R" : "L", pool);
    }
    expect(finishGame(gameId)).toMatchObject({ passed: false, score: 3 });
  });

  it("같은 라운드 두 번 답하기, 순서 건너뛰기, 덜 끝난 finish 는 거부", async () => {
    const pool = makePool(10);
    const { gameId } = await startGame(pool);
    await expect(answerRound(gameId, 1, "L", pool)).rejects.toMatchObject({ status: 409 });
    await answerRound(gameId, 0, "L", pool);
    await expect(answerRound(gameId, 0, "R", pool)).rejects.toMatchObject({ status: 409 });
    expect(() => finishGame(gameId)).toThrow(GameError);
  });

  it("잘못된 입력은 400/404", async () => {
    const pool = makePool(10);
    const { gameId } = await startGame(pool);
    await expect(answerRound("nope", 0, "L", pool)).rejects.toMatchObject({ status: 404 });
    await expect(answerRound(gameId, 0, "X", pool)).rejects.toMatchObject({ status: 400 });
    await expect(answerRound(gameId, 9, "L", pool)).rejects.toMatchObject({ status: 400 });
  });

  it("정답률이 쌍별로 기록된다", async () => {
    const pool = makePool(5);
    const { gameId, rounds } = await startGame(pool);
    for (let i = 0; i < 5; i++) {
      const ai = srcHash(rounds[i].left.src).startsWith("a") ? "L" : "R";
      await answerRound(gameId, i, ai, pool);
    }
    for (let i = 0; i < 5; i++) {
      expect(await pool.get(`p${i}`)).toMatchObject({ servedCount: 1, correctCount: 1 });
    }
  });
});

describe("replaceRound", () => {
  it("다른 주제의 새 쌍으로 바꾸고, 답한 라운드는 못 바꾼다", async () => {
    const pool = makePool(8);
    const { gameId, rounds } = await startGame(pool);
    const before = new Set(rounds.flatMap((r) => [r.left.src, r.right.src]));
    const next = await replaceRound(gameId, 2, pool);
    expect(before.has(next.left.src)).toBe(false);
    expect(before.has(next.right.src)).toBe(false);
    await answerRound(gameId, 0, "L", pool);
    await expect(replaceRound(gameId, 0, pool)).rejects.toMatchObject({ status: 409 });
  });
});

describe("풀 재사용 (한 바퀴 돌면 다시 섞기)", () => {
  it("쌍이 적어도 게임이 멈추지 않고, 모든 쌍이 고르게 나간다", async () => {
    const N = 9;
    const pool = makePool(N);
    let prev = new Set<string>();
    for (let g = 0; g < 36; g++) {
      const { rounds } = await startGame(pool);
      const ids = new Set(rounds.map((r) => srcHash(r.left.src).slice(1)));
      expect(ids.size).toBe(5); // 한 게임 안에서는 중복 없음
      // 9쌍 중 5쌍씩이면 직전 게임과 최소 1쌍은 겹칠 수밖에 없다. 그 이상은 드물어야 한다
      expect([...ids].filter((id) => prev.has(id)).length).toBeLessThanOrEqual(2);
      prev = ids;
    }
    const counts = await Promise.all(
      Array.from({ length: N }, async (_, i) => (await pool.get(`p${i}`))!.servedCount),
    );
    expect(counts.reduce((a, b) => a + b)).toBe(36 * 5);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });

  it("한 바퀴 안에서는 같은 쌍이 다시 나오지 않는다", async () => {
    const pool = makePool(20);
    const seen = new Set<string>();
    for (let g = 0; g < 4; g++) {
      for (const p of await pool.draw(5)) {
        expect(seen.has(p.id)).toBe(false);
        seen.add(p.id);
      }
    }
    expect(seen.size).toBe(20);
    // 다음 바퀴도 5쌍을 정상적으로 준다
    expect(await pool.draw(5)).toHaveLength(5);
  });

  it("새 바퀴의 순서는 매번 같지 않다", async () => {
    const order = async () => {
      const pool = makePool(20);
      for (let g = 0; g < 4; g++) await pool.draw(5); // 첫 바퀴
      const second: string[] = [];
      for (let g = 0; g < 4; g++) second.push(...(await pool.draw(5)).map((p) => p.id));
      return second.join(",");
    };
    const orders = new Set(await Promise.all(Array.from({ length: 5 }, order)));
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe("selectPairs", () => {
  it("이번 바퀴에 안 나간 쌍이 먼저, 직전에 나간 쌍은 맨 뒤", () => {
    const pairs = [
      pair("just", "a", { servedCount: 2, lastServedAt: 900 }),
      pair("done", "b", { servedCount: 2, lastServedAt: 500 }),
      pair("todo", "c", { servedCount: 1, lastServedAt: 100 }),
    ];
    const servedThisCycle = new Set(["just", "done"]);
    expect(selectPairs(pairs, 3, { servedThisCycle }).map((p) => p.id)).toEqual(["todo", "done", "just"]);
  });

  it("안 나간 쌍 우선, 그다음 가장 오래전에 나간 쌍", () => {
    const pairs = [
      pair("old", "a", { servedCount: 1, lastServedAt: 100 }),
      pair("newer", "b", { servedCount: 1, lastServedAt: 500 }),
      pair("fresh", "c"),
    ];
    expect(selectPairs(pairs, 2).map((p) => p.id)).toEqual(["fresh", "old"]);
  });

  it("주제가 겹치지 않게 고르고, 승인 안 된 쌍은 제외", () => {
    const pairs = [pair("1", "a"), pair("2", "a"), pair("3", "b"), pair("4", "c", { status: "pending" })];
    const ids = selectPairs(pairs, 2).map((p) => p.id);
    expect(ids).toHaveLength(2);
    expect(ids).toContain("3");
  });

  it("주제가 모자라면 중복을 허용해서라도 채운다", () => {
    const pairs = [pair("1", "a"), pair("2", "a")];
    expect(selectPairs(pairs, 2)).toHaveLength(2);
  });
});
