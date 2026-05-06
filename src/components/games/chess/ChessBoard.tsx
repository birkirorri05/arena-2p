import GameStub from "../_stub/GameStub";
import type { GameRoom } from "@/types/game";
export default function ChessBoard({ room }: { room: GameRoom }) {
  return <GameStub room={room} name="Chess" />;
}
