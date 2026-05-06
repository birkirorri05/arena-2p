import type { GameRoom } from "@/types/game";

interface Props {
  room: GameRoom;
  name: string;
}

export default function GameStub({ name }: Props) {
  return (
    <div className="flex h-96 flex-col items-center justify-center gap-3 text-arena-text-muted">
      <span className="text-5xl">🚧</span>
      <p className="text-lg font-medium">{name} — Coming soon</p>
      <p className="text-sm">This game is under development.</p>
    </div>
  );
}
