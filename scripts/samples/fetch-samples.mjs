#!/usr/bin/env node
// 개발·테스트용 샘플 풀 만들기: Wikimedia Commons 에서 samples.json 의 사진을 받아
// 1:1 크롭 → webp → 메타데이터 제거 → data/images/{hash}.webp, data/pool.json 생성.
// 원본은 data/.cache/samples 에 남겨서 중간에 끊겨도 이어서 받는다.
//
// 사용: npm run samples
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const IMAGES = path.join(DATA, "images");
const CACHE = path.join(DATA, ".cache", "samples");
const SIZE = 1600;
const UA = { "User-Agent": "image-quiz-sample-fetch/0.1 (dev samples; low volume)" };
const MAX_WAIT_S = 15 * 60;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url, { headers: UA });
    if (res.status === 429 || res.status === 503) {
      const ra = Math.min(Number(res.headers.get("retry-after")) || 30 * (i + 1), MAX_WAIT_S);
      console.log(`  … ${res.status}, ${ra}초 대기 (서버 요청)`);
      await sleep(ra * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res;
  }
  throw new Error(`재시도 초과: ${url}`);
}

const stripHtml = (s = "") =>
  s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

async function imageInfo(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20).map((t) => `File:${t}`);
    const url =
      "https://commons.wikimedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        format: "json",
        titles: batch.join("|"),
        prop: "imageinfo",
        iiprop: "url|extmetadata",
        iiextmetadatafilter: "Artist|LicenseShortName",
      });
    const d = await (await get(url)).json();
    const fromNorm = Object.fromEntries((d.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of Object.values(d.query.pages)) {
      const title = (fromNorm[p.title] ?? p.title).replace(/^File:/, "");
      const ii = p.imageinfo?.[0];
      if (!ii) throw new Error(`Commons 에 없는 파일: ${title}`);
      out[title] = {
        url: ii.url,
        page: ii.descriptionurl,
        artist: stripHtml(ii.extmetadata?.Artist?.value).slice(0, 80) || "Unknown",
        license: stripHtml(ii.extmetadata?.LicenseShortName?.value),
      };
    }
  }
  return out;
}

async function original(title, info) {
  const file = path.join(CACHE, createHash("sha1").update(title).digest("hex"));
  if (existsSync(file)) return readFile(file);
  console.log(`  ↓ ${title}`);
  const buf = Buffer.from(await (await get(info.url)).arrayBuffer());
  await writeFile(file, buf);
  await sleep(2000); // Commons 에 부담 주지 않게
  return buf;
}

/** 1:1 크롭 + webp. sharp 는 기본으로 EXIF/XMP/ICC 등 메타데이터를 모두 버린다. */
async function toWebp(buf, crop) {
  // crop: 목록에서 "north" | "south" | "east" | "west" | "centre" 로 지정하면 자동 크롭 대신 그쪽을 남긴다
  const out = await sharp(buf, { limitInputPixels: false })
    .rotate()
    .resize(SIZE, SIZE, { fit: "cover", position: crop || sharp.strategy.attention })
    .toColourspace("srgb")
    .webp({ quality: 82 })
    .toBuffer();
  const hash = createHash("sha256").update(out).digest("hex").slice(0, 32);
  await writeFile(path.join(IMAGES, `${hash}.webp`), out);
  return hash;
}

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
};

/** --ai-dir 에서 {topic}.png|jpg|jpeg|webp 를 찾는다 (직접 생성한 AI 이미지) */
async function findLocalAi(dir, topic) {
  if (!dir || !existsSync(dir)) return null;
  const hit = (await readdir(dir)).find(
    (f) => /\.(png|jpe?g|webp)$/i.test(f) && path.parse(f).name.toLowerCase() === topic.toLowerCase(),
  );
  return hit ? path.join(dir, hit) : null;
}

async function main() {
  // 기본: 개발용 샘플. 행사용은 `npm run pool` (--list data/event/pairs.json --ai-dir data/inbox/ai)
  const listFile = path.resolve(ROOT, arg("list", "scripts/samples/samples.json"));
  const aiDir = arg("ai-dir") ? path.resolve(ROOT, arg("ai-dir")) : null;
  const idPrefix = arg("id-prefix", aiDir ? "event" : "sample");
  const all = JSON.parse(await readFile(listFile, "utf8")).pairs;
  await mkdir(IMAGES, { recursive: true });
  await mkdir(CACHE, { recursive: true });

  // AI 쪽이 Commons 파일(ai)도 아니고 로컬 파일도 없는 쌍은 건너뛴다 (아직 생성 전)
  const pairs = [];
  const missing = [];
  for (const p of all) {
    const aiFile = p.ai ? null : await findLocalAi(aiDir, p.topic);
    if (p.ai || aiFile) pairs.push({ ...p, aiFile });
    else missing.push(p.topic);
  }
  if (missing.length) console.log(`AI 이미지가 아직 없는 주제 ${missing.length}개: ${missing.join(", ")}`);

  console.log(`${pairs.length}쌍 정보 조회…`);
  const info = await imageInfo(pairs.flatMap((p) => (p.ai ? [p.ai, p.human] : [p.human])));

  const out = [];
  for (const p of pairs) {
    console.log(`[${p.topic}]`);
    const ref = async (title, crop) => {
      const i = info[title];
      return {
        hash: await toWebp(await original(title, i), crop),
        credit: { name: i.artist, link: i.page, source: "Wikimedia Commons", license: i.license || undefined },
      };
    };
    const localAi = async () => ({
      hash: await toWebp(await readFile(p.aiFile), p.aiCrop),
      // aiTool: 생성에 쓴 도구 이름 (예: "ChatGPT"). 원본 페이지가 없으므로 link/source 는 비운다
      credit: { name: p.aiTool || "AI", link: "", source: "" },
    });
    out.push({
      id: `${idPrefix}-${p.topic}`,
      topic: p.topic,
      ai: p.ai ? await ref(p.ai, p.aiCrop) : await localAi(),
      human: await ref(p.human, p.crop),
      status: "approved",
      servedCount: 0,
      correctCount: 0,
      lastServedAt: 0,
    });
  }
  await writeFile(path.join(DATA, "pool.json"), JSON.stringify({ pairs: out }, null, 2));
  console.log(`✓ ${out.length}쌍 → ${path.relative(ROOT, path.join(DATA, "pool.json"))}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
