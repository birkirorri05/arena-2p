import GameStub from "../_stub/GameStub";
import type { GameRoom } from "@/types/game";
export default function GoBoard({ room }: { room: GameRoom }) {
  return <GameStub room={room} name="Go" />;
}
