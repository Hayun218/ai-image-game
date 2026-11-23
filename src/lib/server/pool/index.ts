import { MemoryPool } from "./memory";
import type { PoolStore } from "./types";

const g = globalThis as unknown as { __pool?: Promise<PoolStore> };

/** 프로세스당 하나의 풀 인스턴스 */
export function getPool(): Promise<PoolStore> {
  if (!g.__pool) {
    g.__pool = MemoryPool.load().catch((e) => {
      g.__pool = undefined; // 파일을 만든 뒤 재시도할 수 있게
      throw e;
    });
  }
  return g.__pool;
}

export type { Pair, PoolStore } from "./types";
