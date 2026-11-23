import type { DrawOptions, Pair } from "./types";

/**
 * 쌍 선택 규칙 (저장소 구현과 무관한 순수 함수).
 * 1) 승인된 쌍 중 제외 대상이 아닌 것
 * 2) 아직 안 나간 쌍(servedCount=0)을 무작위로, 주제가 겹치지 않게
 * 3) 모자라면 가장 오래전에 나간 쌍부터, 주제가 겹치지 않게
 * 4) 그래도 모자라면(주제 수 부족) 주제 중복을 허용해서 오래된 순으로 채움
 */
export function selectPairs(
  pairs: Iterable<Pair>,
  count: number,
  opts: DrawOptions = {},
  random: () => number = Math.random,
): Pair[] {
  const excludeTopics = new Set(opts.excludeTopics ?? []);
  const excludeIds = new Set(opts.excludeIds ?? []);
  const candidates = [...pairs].filter(
    (p) => p.status === "approved" && !excludeIds.has(p.id) && !excludeTopics.has(p.topic),
  );

  const unseen = shuffle(
    candidates.filter((p) => p.servedCount === 0),
    random,
  );
  // 같은 시각이면 무작위가 되도록 먼저 섞고 안정 정렬
  const seen = shuffle(
    candidates.filter((p) => p.servedCount > 0),
    random,
  ).sort((a, b) => a.lastServedAt - b.lastServedAt);

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
  take(unseen, true);
  take(seen, true);
  take([...unseen, ...seen], false);
  return picked;
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
