import { readFile } from "node:fs/promises";
import path from "node:path";
import { HASH_RE, imagesDir } from "@/lib/server/data-dir";

// AI/실제 사진 모두 같은 경로·같은 형식(1:1 webp, 메타데이터 없음)으로 나간다.
// 파일 내용이 바뀌면 해시도 바뀌므로 영구 캐시해도 안전하다.
export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  if (!HASH_RE.test(hash)) return new Response("Not found", { status: 404 });
  try {
    const buf = await readFile(path.join(imagesDir(), `${hash}.webp`));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(buf.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
