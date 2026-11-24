#!/usr/bin/env node
// 검수에서 뺄 이미지를 data/build/drop.txt 에 추가한다. 시트의 쌍 번호(#n)로 지정한다.
// 사용: node scripts/build-pool/drop.mjs a12 h40 b7 ...
//   a12 = 12번 쌍의 AI 이미지를 제외, h40 = 40번 쌍의 실제 사진을 제외, b7 = 7번 쌍의 양쪽 모두 제외
// 제외한 뒤 `npm run pool:pair` 를 다시 돌리면 남은 후보로 새로 짝짓는다.
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BUILD = path.join(path.resolve(process.env.DATA_DIR || path.join(ROOT, "data")), "build");
const pairs = JSON.parse(await readFile(path.join(BUILD, "pairs.json"), "utf8"));
const ids = [];
for (const a of process.argv.slice(2)) {
  const m = /^([ahb])(\d+)$/.exec(a);
  const p = m && pairs[Number(m[2])];
  if (!p) throw new Error(`잘못된 지정: ${a}`);
  if (m[1] !== "h") ids.push(p.ai.id);
  if (m[1] !== "a") ids.push(p.human.id);
}
await appendFile(path.join(BUILD, "drop.txt"), ids.join("\n") + "\n");
console.log(`제외 ${ids.length}장 추가`);
