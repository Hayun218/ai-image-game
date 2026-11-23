import { finishGame } from "@/lib/server/game";
import { handle, readJson } from "@/lib/server/http";

export async function POST(req: Request) {
  const body = await readJson(req);
  return handle(() => finishGame(body.gameId));
}
