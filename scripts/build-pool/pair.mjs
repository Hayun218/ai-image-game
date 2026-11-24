#!/usr/bin/env node
// 행사용 풀 3단계: 후보를 걸러내고(사진풍만), 6개 카테고리로 분류하고, AI ↔ 실제 사진을 비슷한 것끼리 짝짓는다.
// 결과: data/build/pairs.json (검수용). --write 를 주면 data/images + data/pool.json 까지 만든다.
//
// 사용: node scripts/build-pool/pair.mjs [--per 100] [--write] [--drop data/build/drop.txt]
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { dot, embedTexts } from "./clip.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const CAND = path.join(DATA, "build", "cand");
const DIM = 512;
const SIZE = 1600;

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};
const PER = Number(arg("per", "100"));
const WRITE = process.argv.includes("--write");

/** 카테고리와 CLIP 문장. 문장을 여러 개 주면 평균을 쓴다 */
const CATEGORIES = {
  people: ["a portrait photo of a person", "a photo of a person's face", "a photo of people"],
  landscape: ["a landscape photo of nature scenery", "a photo of mountains, sea, forest or sky"],
  food: ["a photo of food", "a photo of a dish, meal, dessert or drink"],
  architecture: ["a photo of a building or architecture", "a photo of a house, church, bridge, tower or city skyline"],
  animal: ["a photo of an animal", "a photo of a pet, bird, insect or wild animal"],
  daily: ["a photo of an everyday object", "a photo of a room interior, street, vehicle or daily life scene"],
};
/** 화풍. 첫 번째(사진)의 확률이 MIN_PHOTO 이상인 것만 쓴다 */
const STYLES = [
  "a photograph taken with a camera",
  "a painting, drawing or illustration",
  "a cartoon, anime or pixel art image",
  "a 3d render or computer graphics",
  "a screenshot, poster or image with text and letters",
  "a collage or grid of several pictures",
  "a fantasy or science fiction scene",
];
const MIN_PHOTO = 0.45;
const MIN_CATEGORY = 0.6; // 카테고리 확률이 이보다 낮으면 애매한 이미지로 보고 버린다
const MIN_SIM = 0.66; // 짝의 최소 유사도
/**
 * "잘 찍은 정도" 균형. AI 이미지는 화보처럼 매끈한 것이 많아서, 그대로 짝지으면 "더 예쁜 쪽 = AI" 로 맞힐 수 있다.
 * CLIP 으로 각 이미지의 화보 같은 정도(0~1)를 재고, 실제 사진이 AI 만큼 또는 그보다 잘 찍힌 쌍을 우선한다.
 * (실제 사진이 항상 더 예쁘면 그것도 힌트가 되므로, AI 가 조금 더 화보 같은 쌍도 일부 남긴다.)
 */
const POLISH = [
  "a stunning professional photograph, award-winning, beautiful lighting",
  "an ordinary amateur snapshot, plain documentary photo",
];
const MAX_AI_LEAD = 0.15; // AI 가 실제 사진보다 화보 같을 수 있는 한도
const MAX_REAL_LEAD = 0.25; // 실제 사진이 AI 보다 화보 같을 수 있는 한도
const RELAX_STEP = 0.2; // 100쌍이 안 차는 카테고리에서만 한도를 이만큼 넓힌다
const GAP_WEIGHT = 0.3; // AI 가 앞설수록 짝 점수를 깎는다
const REAL_POLISH_BONUS = 0.08; // 실제 사진이 잘 찍힌 쌍을 우선한다
const MAX_DUP = 0.93; // 같은 쪽에서 이보다 비슷한 이미지는 중복으로 본다 (같은 프롬프트의 변형 등)

const softmax = (scores, t = 100) => {
  const m = Math.max(...scores);
  const ex = scores.map((s) => Math.exp((s - m) * t));
  const z = ex.reduce((a, b) => a + b, 0);
  return ex.map((x) => x / z);
};
const mean = (vs) => {
  const out = new Float32Array(DIM);
  for (const v of vs) for (let i = 0; i < DIM; i++) out[i] += v[i];
  let n = 0;
  for (const x of out) n += x * x;
  n = Math.sqrt(n);
  return out.map((x) => x / n);
};

/** 라벨 없이 전부 AI 이미지인 데이터셋 → 생성 모델 이름 */
const AI_ONLY = {
  "Photoroom__midjourney-v6-recap": "Midjourney v6",
  "ash12321__flux-1-dev-generated-10k": "FLUX.1 dev",
};

/** 데이터셋 라벨 → "ai" | "human" */
function kindOf(name, label) {
  if (AI_ONLY[name]) return "ai";
  if (label == null) return null;
  const l = String(label).toLowerCase();
  if (l === "real" || l === "human") return "human";
  return "ai"; // fake, ai, 또는 생성 모델 이름
}

const CREDIT = {
  ai: (it) => ({
    name: it.generator ? `AI (${it.generator})` : "AI 생성 이미지",
    link: `https://huggingface.co/datasets/${it.ds}`,
    source: "Hugging Face",
  }),
  human: (it) =>
    it.commons
      ? { name: it.commons.artist, link: it.commons.link, source: "Wikimedia Commons", license: it.commons.license || undefined }
      : { name: it.ds.split("/")[0], link: `https://huggingface.co/datasets/${it.ds}`, source: "Hugging Face" },
};

async function loadItems() {
  const items = [];
  for (const name of await readdir(CAND)) {
    const dir = path.join(CAND, name);
    if (!existsSync(path.join(dir, "emb.idx"))) continue;
    const meta = new Map();
    for (const line of (await readFile(path.join(dir, "meta.jsonl"), "utf8")).split("\n")) {
      if (!line) continue;
      try {
        const m = JSON.parse(line);
        meta.set(String(m.row), m);
      } catch {
        // 여러 수집기가 동시에 쓰다 깨진 줄은 건너뛴다
      }
    }
    const idx = (await readFile(path.join(dir, "emb.idx"), "utf8")).split("\n").filter(Boolean);
    const buf = await readFile(path.join(dir, "emb.f32"));
    const all = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    idx.forEach((row, i) => {
      const m = meta.get(row);
      const kind = m && kindOf(name, m.label);
      if (!kind) return;
      const generator = AI_ONLY[name] ?? (kind === "ai" && !/^(fake|ai)$/i.test(String(m.label ?? "")) ? m.label : null);
      items.push({
        id: `${name}/${row}`,
        ds: name.replace("__", "/"),
        file: path.join(dir, `${row}.jpg`),
        kind,
        generator,
        commons: /^commons(fp)?__/.test(name) ? { artist: m.artist, license: m.license, link: m.link } : null,
        w: m.w,
        h: m.h,
        emb: all.subarray(i * DIM, (i + 1) * DIM),
      });
    });
  }
  return items;
}

/** 흑백·세피아처럼 색이 거의 없는 사진인지 (한쪽만 흑백이면 바로 티가 난다) */
async function isMonochrome(file) {
  const { data } = await sharp(file).resize(48, 48, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let sat = 0;
  for (let i = 0; i < data.length; i += 3) sat += Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
  return sat / (data.length / 3) < 14;
}

async function toWebp(file) {
  const out = await sharp(file)
    .resize(SIZE, SIZE, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toBuffer();
  const hash = createHash("sha256").update(out).digest("hex").slice(0, 32);
  await writeFile(path.join(DATA, "images", `${hash}.webp`), out);
  return hash;
}

async function main() {
  const items = await loadItems();
  console.log(`후보 ${items.length}장 (AI ${items.filter((i) => i.kind === "ai").length}, 실제 ${items.filter((i) => i.kind === "human").length})`);

  const dropFile = arg("drop") ? path.resolve(ROOT, arg("drop")) : path.join(DATA, "build", "drop.txt");
  const drop = new Set(existsSync(dropFile) ? (await readFile(dropFile, "utf8")).split(/\s+/).filter(Boolean) : []);

  const styleT = await embedTexts(STYLES);
  const cats = Object.keys(CATEGORIES);
  const catT = [];
  for (const c of cats) catT.push(mean(await embedTexts(CATEGORIES[c])));
  const polishT = await embedTexts(POLISH);

  // 1) 사진풍만 남기고 카테고리 분류
  const byCat = Object.fromEntries(cats.map((c) => [c, { ai: [], human: [] }]));
  let notPhoto = 0;
  let vague = 0;
  let mono = 0;
  for (const it of items) {
    if (drop.has(it.id)) continue;
    const ps = softmax(styleT.map((t) => dot(it.emb, t)));
    it.photo = ps[0];
    if (ps[0] < MIN_PHOTO) {
      notPhoto++;
      continue;
    }
    const pc = softmax(catT.map((t) => dot(it.emb, t)));
    const best = pc.indexOf(Math.max(...pc));
    if (pc[best] < MIN_CATEGORY) {
      vague++;
      continue;
    }
    if (await isMonochrome(it.file)) {
      mono++;
      continue;
    }
    it.pro = softmax(polishT.map((t) => dot(it.emb, t)))[0];
    it.cat = cats[best];
    byCat[it.cat][it.kind].push(it);
  }
  console.log(`사진풍이 아니라서 제외 ${notPhoto}, 카테고리가 애매해서 제외 ${vague}, 흑백이라 제외 ${mono}`);

  // 2) 카테고리 안에서 비슷한 것끼리 짝짓기 (유사도 높은 순으로 탐욕 선택, 양쪽 모두 중복 제거)
  const pairs = [];
  for (const c of cats) {
    const { ai, human } = byCat[c];
    const usedA = new Set();
    const usedH = new Set();
    const picked = [];
    // 1차: 품질 차이 한도 안에서 고른다. 2·3차: 그래도 모자란 카테고리만 한도를 넓혀서 채운다
    for (const relax of [0, RELAX_STEP, RELAX_STEP * 2.5]) {
      if (picked.length >= PER) break;
      const cand = [];
      for (let a = 0; a < ai.length; a++) {
        if (usedA.has(a)) continue;
        for (let h = 0; h < human.length; h++) {
          if (usedH.has(h)) continue;
          const s = dot(ai[a].emb, human[h].emb);
          const lead = ai[a].pro - human[h].pro; // 양수면 AI 가 더 화보 같다
          if (s < MIN_SIM || lead > MAX_AI_LEAD + relax || -lead > MAX_REAL_LEAD + relax) continue;
          cand.push([s - GAP_WEIGHT * Math.max(0, lead) + REAL_POLISH_BONUS * human[h].pro, a, h, s]);
        }
      }
      cand.sort((x, y) => y[0] - x[0]);
      for (const [, a, h, s] of cand) {
        if (picked.length >= PER) break;
        if (usedA.has(a) || usedH.has(h)) continue;
        const dupA = picked.some((p) => dot(p.ai.emb, ai[a].emb) > MAX_DUP);
        const dupH = picked.some((p) => dot(p.human.emb, human[h].emb) > MAX_DUP);
        if (dupA) usedA.add(a);
        if (dupH) usedH.add(h);
        if (dupA || dupH) continue;
        usedA.add(a);
        usedH.add(h);
        picked.push({ cat: c, sim: s, ai: ai[a], human: human[h] });
      }
    }
    const sims = picked.map((p) => p.sim).sort((x, y) => x - y);
    const aiPrettier = picked.filter((p) => p.ai.pro > p.human.pro).length;
    console.log(`${c.padEnd(13)} AI ${String(ai.length).padStart(5)}  실제 ${String(human.length).padStart(5)}  → ${picked.length}쌍 (유사도 ${picked.length ? sims[0].toFixed(2) + "~" + sims.at(-1).toFixed(2) : "-"}, AI 가 더 화보 같은 쌍 ${aiPrettier})`);
    pairs.push(...picked);
  }

  const slim = (it) => ({ id: it.id, file: it.file, ds: it.ds, generator: it.generator, photo: +it.photo.toFixed(2), pro: +it.pro.toFixed(2) });
  await writeFile(
    path.join(DATA, "build", "pairs.json"),
    JSON.stringify(pairs.map((p) => ({ cat: p.cat, sim: +p.sim.toFixed(3), ai: slim(p.ai), human: slim(p.human) })), null, 1),
  );
  console.log(`✓ ${pairs.length}쌍 → data/build/pairs.json`);
  if (!WRITE) return;

  // 3) 게임용 풀로 내보내기
  await mkdir(path.join(DATA, "images"), { recursive: true });
  const poolFile = path.join(DATA, "pool.json");
  if (existsSync(poolFile) && !existsSync(path.join(DATA, "pool.samples.json"))) {
    await copyFile(poolFile, path.join(DATA, "pool.samples.json")); // 샘플 풀 백업
  }
  const n = Object.fromEntries(cats.map((c) => [c, 0]));
  const out = [];
  for (const p of pairs) {
    out.push({
      id: `event-${p.cat}-${String(++n[p.cat]).padStart(3, "0")}`,
      topic: p.cat,
      ai: { hash: await toWebp(p.ai.file), credit: CREDIT.ai(p.ai) },
      human: { hash: await toWebp(p.human.file), credit: CREDIT.human(p.human) },
      status: "approved",
      servedCount: 0,
      correctCount: 0,
      lastServedAt: 0,
    });
  }
  await writeFile(poolFile, JSON.stringify({ pairs: out }, null, 2));
  console.log(`✓ ${out.length}쌍 → data/pool.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
