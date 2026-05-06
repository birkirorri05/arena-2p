import GameStub from "../_stub/GameStub";
import type { GameRoom } from "@/types/game";
export default function PongCanvas({ room }: { room: GameRoom }) {
  return <GameStub room={room} name="Pong" />;
}
