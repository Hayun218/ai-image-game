import { readFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "../data-dir";
import { selectPairs } from "./select";
import type { DrawOptions, Pair, PoolStore } from "./types";

/**
 * data/pool.json 을 읽어 메모리에서 동작하는 풀 (2단계용).
 * 단일 Node 프로세스 안에서 동기적으로 선택·표시하므로 동시 요청에도 같은 쌍이 중복되지 않는다.
 * 통계는 프로세스가 살아 있는 동안만 유지된다 (3단계에서 SQLite 로 교체).
 */
export class MemoryPool implements PoolStore {
  constructor(private readonly pairs: Map<string, Pair>) {}

  static async load(file = path.join(dataDir(), "pool.json")): Promise<MemoryPool> {
    let raw: string;
    try {
      raw = await readFile(file, "utf8");
    } catch {
      throw new Error(
        `사진 풀 파일이 없습니다: ${file}\n샘플 풀을 만들려면 \`npm run samples\` 를 실행하세요.`,
      );
    }
    const json = JSON.parse(raw) as { pairs: Pair[] };
    return new MemoryPool(new Map(json.pairs.map((p) => [p.id, { ...p }])));
  }

  /** 이번 바퀴에 이미 나간 쌍. 다 돌면 비우고 새 바퀴를 시작한다 */
  private cycle = new Set<string>();
  private lastDrawAt = 0;

  async draw(count: number, opts?: DrawOptions): Promise<Pair[]> {
    const picked = selectPairs(this.pairs.values(), count, { ...opts, servedThisCycle: this.cycle });
    // 이번 바퀴에 이미 나간 쌍을 다시 꺼냈다면 한 바퀴가 끝난 것 → 그 쌍들부터 새 바퀴
    const recycled = picked.filter((p) => this.cycle.has(p.id));
    if (recycled.length > 0) this.cycle = new Set(recycled.map((p) => p.id));
    else for (const p of picked) this.cycle.add(p.id);
    // 같은 ms 에 연달아 꺼내도 "직전에 나간 쌍" 구분이 되도록 단조 증가
    const now = (this.lastDrawAt = Math.max(Date.now(), this.lastDrawAt + 1));
    for (const p of picked) {
      p.servedCount += 1;
      p.lastServedAt = now;
    }
    return picked.map((p) => ({ ...p }));
  }

  async recordResult(pairId: string, correct: boolean): Promise<void> {
    const p = this.pairs.get(pairId);
    if (p && correct) p.correctCount += 1;
  }

  async get(pairId: string): Promise<Pair | null> {
    const p = this.pairs.get(pairId);
    return p ? { ...p } : null;
  }
}
