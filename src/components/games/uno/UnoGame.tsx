import GameStub from "../_stub/GameStub";
import type { GameRoom } from "@/types/game";
export default function UnoGame({ room }: { room: GameRoom }) {
  return <GameStub room={room} name="Uno" />;
}
