#!/usr/bin/env node
// 행사용 풀 1단계(실제 사진 보충): Wikimedia Commons 의 Quality images 에서 카테고리별 실제 사진을 받는다.
// data/build/cand/commons__{카테고리}/ 에 1280px 썸네일로 저장하고, 촬영자·라이선스·원본 링크를 meta 에 남긴다.
// Commons 는 요청 제한(429)이 잦으므로 요청 사이에 쉬고 Retry-After 를 지킨다. 이어받기 가능.
//
// 사용: node scripts/build-pool/collect-commons.mjs [카테고리 ...]   (없으면 전부)
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DATA = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const UA = { "User-Agent": "image-quiz-sample-fetch/0.1 (dev samples; low volume)" };
const QI = 'incategory:"Quality images"';
const PER_QUERY = 50;
const MIN_SIDE = 800;

const QUERIES = {
  landscape: ["mountain landscape", "lake reflection", "sea coast cliffs", "forest trees", "river valley", "desert dunes", "waterfall", "meadow field sunset"],
  food: ["food dish plate", "cake dessert", "bread bakery", "fruit", "vegetables", "soup", "pasta", "coffee cup", "breakfast", "cheese"],
  architecture: ["church exterior", "castle", "bridge", "modern building facade", "skyscraper", "old town street houses", "house exterior", "tower"],
  animal: ["bird perched", "mammal wildlife", "cat", "dog", "butterfly insect", "deer", "horse", "frog reptile"],
  daily: ["street scene", "room interior", "car parked", "bicycle", "market stall", "kitchen", "railway station platform", "shop window", "tools workshop", "tram"],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 8; i++) {
    let res;
    try {
      res = await fetch(url, { headers: UA });
    } catch {
      await sleep(5000 * (i + 1));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      const ra = Math.min(Number(res.headers.get("retry-after")) || 30 * (i + 1), 900);
      console.log(`  … ${res.status}, ${ra}초 대기 (서버 요청)`);
      await sleep(ra * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${url.slice(0, 100)}`);
    return res;
  }
  throw new Error(`재시도 초과: ${url.slice(0, 100)}`);
}
const stripHtml = (s = "") => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

const want = process.argv.slice(2);
for (const [cat, queries] of Object.entries(QUERIES)) {
  if (want.length && !want.includes(cat)) continue;
  const dir = path.join(DATA, "build", "cand", `commons__${cat}`);
  const metaFile = path.join(dir, "meta.jsonl");
  await mkdir(dir, { recursive: true });
  const done = new Set();
  if (existsSync(metaFile)) {
    for (const line of (await readFile(metaFile, "utf8")).split("\n")) if (line) done.add(JSON.parse(line).row);
  }
  let saved = 0;
  for (const query of queries) {
    await sleep(2500);
    const url =
      "https://commons.wikimedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        format: "json",
        generator: "search",
        gsrnamespace: "6",
        gsrsearch: `${query} ${QI} filetype:bitmap`,
        gsrlimit: String(PER_QUERY),
        prop: "imageinfo",
        iiprop: "url|size|extmetadata",
        iiextmetadatafilter: "Artist|LicenseShortName",
        iiurlwidth: "1280",
      });
    const d = await (await get(url)).json();
    const pages = Object.values(d.query?.pages ?? {});
    console.log(`[${cat}] "${query}": ${pages.length}건`);
    for (const p of pages) {
      const ii = p.imageinfo?.[0];
      const row = p.pageid;
      if (!ii?.thumburl || done.has(row) || !/\.jpe?g$/i.test(p.title)) continue;
      const ratio = ii.width / ii.height;
      if (Math.min(ii.thumbwidth, ii.thumbheight) < MIN_SIDE || ratio > 1.8 || ratio < 0.55) continue; // 파노라마 제외
      try {
        const buf = Buffer.from(await (await get(ii.thumburl)).arrayBuffer());
        await sharp(buf).rotate().toColourspace("srgb").jpeg({ quality: 90 }).toFile(path.join(dir, `${row}.jpg`));
        await appendFile(
          metaFile,
          JSON.stringify({
            row,
            label: "real",
            w: ii.thumbwidth,
            h: ii.thumbheight,
            title: p.title,
            artist: stripHtml(ii.extmetadata?.Artist?.value).slice(0, 80) || "Unknown",
            license: stripHtml(ii.extmetadata?.LicenseShortName?.value),
            link: ii.descriptionurl,
          }) + "\n",
        );
        done.add(row);
        saved++;
      } catch (e) {
        console.log(`  실패 ${p.title}: ${e.message}`);
      }
      await sleep(1000);
    }
  }
  console.log(`✓ ${cat}: 새로 저장 ${saved}장`);
}
