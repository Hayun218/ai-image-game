import { replaceRound } from "@/lib/server/game";
import { handle, readJson } from "@/lib/server/http";

export async function POST(req: Request) {
  const body = await readJson(req);
  return handle(() => replaceRound(body.gameId, body.round));
}
