#!/usr/bin/env node
// 검수용 시트: data/build/pairs.json 의 쌍을 한 장에 모아 본다 (왼쪽 AI, 오른쪽 실제 사진).
// 사용: node scripts/build-pool/sheet.mjs [--cat people] [--from 0] [--count 24] [--every 1] --out <png>
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const cat = arg("cat");
const from = Number(arg("from", "0"));
const count = Number(arg("count", "24"));
const every = Number(arg("every", "1"));
const out = arg("out", path.join(DATA, "build", "sheet.png"));
const CELL = Number(arg("cell", "236"));
const COLS = Number(arg("cols", "4")); // 한 줄에 몇 쌍

let pairs = JSON.parse(await readFile(path.join(DATA, "build", "pairs.json"), "utf8")).map((p, i) => ({ ...p, n: i }));
if (cat) pairs = pairs.filter((p) => p.cat === cat);
// --idx <json 파일>: 쌍 번호 배열에 든 것만 본다 (다시 짝지은 뒤 새로 들어온 쌍만 검수할 때)
if (arg("idx")) {
  const only = new Set(JSON.parse(await readFile(arg("idx"), "utf8")));
  pairs = pairs.filter((p) => only.has(p.n));
}
pairs = pairs.filter((_, i) => i >= from && (i - from) % every === 0).slice(0, count);

const side = arg("side"); // "ai" 또는 "human" 이면 그쪽 이미지만 크게 본다
const W = side ? 1 : 2;
const comps = [];
for (let k = 0; k < pairs.length; k++) {
  const p = pairs[k];
  const x = (k % COLS) * CELL * W;
  const y = Math.floor(k / COLS) * CELL;
  for (const [s, it] of side ? [[0, p[side]]] : [[0, p.ai], [1, p.human]]) {
    const img = await sharp(it.file).resize(CELL - 4, CELL - 4, { fit: "cover", position: sharp.strategy.attention }).png().toBuffer();
    comps.push({ input: img, left: x + s * CELL + 2, top: y + 2 });
  }
  const label = side ? `#${p.n}` : `#${p.n} ${p.cat} ${p.sim.toFixed(2)}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="190" height="22"><rect width="190" height="22" fill="black" fill-opacity="0.8"/><text x="4" y="16" font-family="Arial" font-size="15" font-weight="bold" fill="white">${label}</text></svg>`;
  comps.push({ input: Buffer.from(svg), left: x + 2, top: y + 2 });
  // 쌍 사이 구분선
  if (!side) comps.push({ input: { create: { width: 4, height: CELL, channels: 3, background: "#e33" } }, left: x + CELL * 2 - 2, top: y });
}
await sharp({ create: { width: COLS * CELL * W, height: Math.ceil(pairs.length / COLS) * CELL, channels: 3, background: "#222" } })
  .composite(comps)
  .png()
  .toFile(out);
console.log(out);
