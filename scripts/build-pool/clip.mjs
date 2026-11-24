// CLIP 임베딩 (노트북 CPU 에서 로컬 실행, 외부 API 없음). 모델은 처음 한 번만 Hugging Face 에서 받는다.
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  env,
} from "@huggingface/transformers";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
env.cacheDir = path.join(ROOT, "data", ".cache", "models");

export const MODEL = "Xenova/clip-vit-base-patch16";

let vision, processor, text, tokenizer;

const normalize = (v) => {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return Float32Array.from(v, (x) => x / n);
};

/** 이미지 파일 경로 배열 → 정규화된 임베딩 배열 */
export async function embedImages(files) {
  processor ??= await AutoProcessor.from_pretrained(MODEL);
  vision ??= await CLIPVisionModelWithProjection.from_pretrained(MODEL);
  const images = await Promise.all(files.map((f) => RawImage.read(f)));
  const { image_embeds } = await vision(await processor(images));
  const dim = image_embeds.dims[1];
  return files.map((_, i) => normalize(image_embeds.data.subarray(i * dim, (i + 1) * dim)));
}

/** 문장 배열 → 정규화된 임베딩 배열 */
export async function embedTexts(texts) {
  tokenizer ??= await AutoTokenizer.from_pretrained(MODEL);
  text ??= await CLIPTextModelWithProjection.from_pretrained(MODEL);
  const { text_embeds } = await text(tokenizer(texts, { padding: true, truncation: true }));
  const dim = text_embeds.dims[1];
  return texts.map((_, i) => normalize(text_embeds.data.subarray(i * dim, (i + 1) * dim)));
}

export const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
