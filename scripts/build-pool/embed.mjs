#!/usr/bin/env node
// 행사용 풀 2단계: data/build/cand/* 의 후보 이미지를 CLIP 으로 임베딩해서 저장한다 (이어받기 가능).
// 결과: data/build/cand/{이름}/emb.f32 (512차원 float32 를 이어 붙인 파일) + emb.idx (행 번호, 한 줄에 하나)
//
// 사용: node scripts/build-pool/embed.mjs
import { existsSync } from "node:fs";
import { appendFile, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { embedImages } from "./clip.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CAND = path.join(path.resolve(process.env.DATA_DIR || path.join(ROOT, "data")), "build", "cand");
const BATCH = 16;

for (const name of await readdir(CAND)) {
  const dir = path.join(CAND, name);
  if (!existsSync(path.join(dir, "meta.jsonl"))) continue;
  const idxFile = path.join(dir, "emb.idx");
  const done = new Set(existsSync(idxFile) ? (await readFile(idxFile, "utf8")).split("\n").filter(Boolean) : []);
  const rows = (await readdir(dir)).filter((f) => f.endsWith(".jpg")).map((f) => f.slice(0, -4)).filter((r) => !done.has(r));
  console.log(`${name}: 임베딩할 이미지 ${rows.length}장 (완료 ${done.size})`);
  const t0 = Date.now();
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    let embs;
    try {
      embs = await embedImages(batch.map((r) => path.join(dir, `${r}.jpg`)));
    } catch (e) {
      console.log(`  배치 실패 (${batch[0]}…): ${e.message}`);
      continue;
    }
    await appendFile(path.join(dir, "emb.f32"), Buffer.concat(embs.map((e) => Buffer.from(e.buffer, e.byteOffset, e.byteLength))));
    await appendFile(idxFile, batch.join("\n") + "\n");
    if ((i / BATCH) % 25 === 0) {
      const rate = (i + batch.length) / ((Date.now() - t0) / 1000);
      console.log(`  ${i + batch.length}/${rows.length} (${rate.toFixed(1)}장/초)`);
    }
  }
}
console.log("✓ 임베딩 완료");
