import type { Credit } from "@/lib/api-types";

export interface ImageRef {
  /** data/images/{hash}.webp — 파일명에 ai/human 정보가 들어가지 않는다 */
  hash: string;
  credit: Credit | null;
}

export type PairStatus = "pending" | "approved" | "rejected" | "retired";

export interface Pair {
  id: string;
  topic: string;
  ai: ImageRef;
  human: ImageRef;
  status: PairStatus;
  servedCount: number;
  correctCount: number;
  /** epoch ms. 한 번도 안 나갔으면 0 */
  lastServedAt: number;
}

export interface DrawOptions {
  excludeTopics?: Iterable<string>;
  excludeIds?: Iterable<string>;
  /** 이번 바퀴에 이미 나간 쌍 id (저장소가 넣어 준다). 없으면 servedCount > 0 으로 판단 */
  servedThisCycle?: ReadonlySet<string>;
}

export interface PoolStore {
  /**
   * 서로 다른 주제의 승인된 쌍을 count개 꺼내고 "나감"으로 표시한다.
   * 안 나간 쌍 우선. 풀을 한 바퀴 다 돌면 전체를 다시 섞어서 재사용한다 (select.ts 참고).
   */
  draw(count: number, opts?: DrawOptions): Promise<Pair[]>;
  /** 한 라운드 결과를 쌍별 정답률에 반영 */
  recordResult(pairId: string, correct: boolean): Promise<void>;
  get(pairId: string): Promise<Pair | null>;
}
