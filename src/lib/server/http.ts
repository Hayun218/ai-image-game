import { GameError } from "./game";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: NO_STORE });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function handle(fn: () => Promise<unknown> | unknown): Promise<Response> {
  return Promise.resolve()
    .then(fn)
    .then((data) => json(data))
    .catch((e: unknown) => {
      if (e instanceof GameError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: e instanceof Error ? e.message : "서버 오류" }, 500);
    });
}
