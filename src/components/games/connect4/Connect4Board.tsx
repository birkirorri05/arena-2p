import GameStub from "../_stub/GameStub";
import type { GameRoom } from "@/types/game";
export default function Connect4Board({ room }: { room: GameRoom }) {
  return <GameStub room={room} name="Connect 4" />;
}
