import type { DrawOptions, Pair } from "./types";

/**
 * 쌍 선택 규칙 (저장소 구현과 무관한 순수 함수).
 *
 * 풀을 "바퀴" 단위로 돈다. 한 바퀴 안에서는 같은 쌍이 두 번 나가지 않고,
 * 다 돌면 전체를 다시 섞어서 새 바퀴를 시작한다 (풀이 작아도 게임이 멈추지 않는다).
 *
 * 1) 승인된 쌍 중 제외 대상이 아닌 것
 * 2) 이번 바퀴에 아직 안 나간 쌍을 무작위로, 주제가 겹치지 않게
 *    (한 번도 안 나간 쌍이 먼저)
 * 3) 모자라면 새 바퀴: 이미 나간 쌍 전체를 다시 섞어서, 주제가 겹치지 않게
 * 4) 그래도 모자라면(주제 수 부족) 주제 중복을 허용해서 채움
 *
 * 2)·3) 모두 바로 직전 게임에 나간 쌍은 뒤로 미뤄서, 연달아 같은 사진이 나오는 일을 줄인다.
 * opts.servedThisCycle 이 없으면 servedCount > 0 인 쌍을 "이번 바퀴에 나간 쌍"으로 본다.
 */
export function selectPairs(
  pairs: Iterable<Pair>,
  count: number,
  opts: DrawOptions = {},
  random: () => number = Math.random,
): Pair[] {
  const excludeTopics = new Set(opts.excludeTopics ?? []);
  const excludeIds = new Set(opts.excludeIds ?? []);
  const cycle = opts.servedThisCycle;
  const inCycle = (p: Pair) => (cycle ? cycle.has(p.id) : p.servedCount > 0);
  const candidates = [...pairs].filter(
    (p) => p.status === "approved" && !excludeIds.has(p.id) && !excludeTopics.has(p.topic),
  );

  // 직전 draw 에서 나간 쌍 (한 번도 안 나간 풀이면 없음)
  const lastAt = candidates.reduce((m, p) => Math.max(m, p.lastServedAt), 0);
  const justServed = (p: Pair) => lastAt > 0 && p.lastServedAt === lastAt;
  // 무작위로 섞은 뒤 안정 정렬: 한 번도 안 나간 쌍 → 나머지 → 직전에 나간 쌍
  const rank = (p: Pair) => (p.servedCount === 0 ? 0 : justServed(p) ? 2 : 1);
  const mixed = (list: Pair[]) => shuffle(list, random).sort((a, b) => rank(a) - rank(b));

  const fresh = mixed(candidates.filter((p) => !inCycle(p)));
  const recycled = mixed(candidates.filter(inCycle));

  const picked: Pair[] = [];
  const usedTopics = new Set<string>();
  const usedIds = new Set<string>();
  const take = (list: Pair[], distinctTopic: boolean) => {
    for (const p of list) {
      if (picked.length >= count) return;
      if (usedIds.has(p.id)) continue;
      if (distinctTopic && usedTopics.has(p.topic)) continue;
      picked.push(p);
      usedIds.add(p.id);
      usedTopics.add(p.topic);
    }
  };
  take(fresh, true);
  take(recycled, true);
  take([...fresh, ...recycled], false);
  return picked;
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
