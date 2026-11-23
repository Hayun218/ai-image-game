import path from "node:path";

/** 사진·쌍 데이터 폴더. 기본 ./data (gitignore 됨) */
export function dataDir(): string {
  return path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
}

export function imagesDir(): string {
  return path.join(dataDir(), "images");
}

/** 해시 형식만 허용 (경로 조작 방지) */
export const HASH_RE = /^[a-f0-9]{32}$/;
