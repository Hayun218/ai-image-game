#!/usr/bin/env node
// 행사용 풀 1단계: Hugging Face 데이터셋에서 후보 이미지를 받아 data/build/cand/{이름}/ 에 저장한다.
// 긴 변 1600px JPEG 로 줄여서 저장하고(메타데이터 제거), 짧은 변이 MIN_SIDE 보다 작은 것은 버린다.
// 중간에 끊겨도 다시 실행하면 이어서 받는다.
//
// 사용: node scripts/build-pool/collect.mjs --ds <owner/name> [--split train] [--from 0] [--to N] [--step 1]
//        [--only "<캡션 정규식>"] [--skip "<캡션 정규식>"] [--max 5000]
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const API = "https://datasets-server.huggingface.co";
const UA = { "User-Agent": "image-quiz-pool-builder/0.1 (low volume)" };
const MIN_SIDE = 800;
const MAX_SIDE = 1600;
const PAGE = 100;
const CONCURRENCY = 6;

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, asJson) {
  for (let i = 0; i < 7; i++) {
    let res;
    try {
      res = await fetch(url, { headers: UA });
    } catch {
      await sleep(3000 * (i + 1));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      const ra = Number(res.headers.get("retry-after")) || 5 * (i + 1);
      await sleep(Math.min(ra, 300) * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url.slice(0, 120)}`);
    return asJson ? res.json() : Buffer.from(await res.arrayBuffer());
  }
  throw new Error(`재시도 초과: ${url.slice(0, 120)}`);
}

const ds = arg("ds");
if (!ds) throw new Error("--ds 가 필요합니다");
const config = arg("config", "default");
const split = arg("split", "train");
const step = Number(arg("step", "1")); // 페이지 단위로 건너뛰기 (큰 데이터셋에서 고르게 뽑을 때)
const only = arg("only") ? new RegExp(arg("only"), "i") : null;
const skip = arg("skip") ? new RegExp(arg("skip"), "i") : null;
const max = Number(arg("max", "1e9"));
const name = ds.replace("/", "__");
const dir = path.join(DATA, "build", "cand", name);
const metaFile = path.join(dir, "meta.jsonl");
await mkdir(dir, { recursive: true });

const done = new Set();
if (existsSync(metaFile)) {
  for (const line of (await readFile(metaFile, "utf8")).split("\n")) if (line) done.add(JSON.parse(line).row);
}

const q = (o) => new URLSearchParams({ dataset: ds, config, split, ...o });
const size = await get(`${API}/size?${q({})}`, true).catch(() => null);
const total = size?.size?.splits?.find((s) => s.split === split)?.num_rows ?? Number(arg("to", "0"));
const from = Number(arg("from", "0"));
const to = Math.min(Number(arg("to", String(total))), total);
console.log(`${ds} ${split}: rows ${from}..${to} (전체 ${total}), 이미 받은 것 ${done.size}`);

let saved = 0;
let seen = 0;
for (let offset = from; offset < to && saved < max; offset += PAGE * step) {
  const d = await get(`${API}/rows?${q({ offset: String(offset), length: String(Math.min(PAGE, to - offset)) })}`, true);
  const names = d.features.find((f) => f.type.names && /label/i.test(f.name));
  const jobs = [];
  for (const r of d.rows) {
    seen++;
    if (done.has(r.row_idx)) continue;
    const row = r.row;
    const imgKey = Object.keys(row).find((k) => row[k] && typeof row[k] === "object" && row[k].src);
    if (!imgKey) continue;
    const im = row[imgKey];
    if (Math.min(im.width, im.height) < MIN_SIDE) continue;
    const caption = row.gemini || row.qwen3 || row.llava || row.prompt || row.caption || row.text || "";
    if (only && !only.test(caption)) continue;
    if (skip && skip.test(caption)) continue;
    const label = names ? names.type.names[row[names.name]] : (row.label_text ?? row.label ?? null);
    jobs.push({ row: r.row_idx, src: im.src, w: im.width, h: im.height, label, caption: String(caption).slice(0, 300), source: row.source_dataset });
  }
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    await Promise.all(
      jobs.slice(i, i + CONCURRENCY).map(async (j) => {
        try {
          const buf = await get(j.src, false);
          await sharp(buf, { limitInputPixels: false })
            .rotate()
            .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
            .toColourspace("srgb")
            .jpeg({ quality: 90 })
            .toFile(path.join(dir, `${j.row}.jpg`));
          await appendFile(metaFile, JSON.stringify({ ...j, src: undefined }) + "\n");
          saved++;
        } catch (e) {
          console.log(`  실패 row ${j.row}: ${e.message}`);
        }
      }),
    );
  }
  if ((offset / PAGE) % 10 === 0) console.log(`  offset ${offset}: 확인 ${seen}, 저장 ${saved}`);
}
console.log(`✓ ${name}: 새로 저장 ${saved}장 → ${path.relative(ROOT, dir)}`);
