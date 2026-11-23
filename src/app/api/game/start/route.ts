import { startGame } from "@/lib/server/game";
import { handle } from "@/lib/server/http";

export async function POST() {
  return handle(() => startGame());
}
