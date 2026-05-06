import Link from "next/link";
import { GameLogo } from "./GameLogo";
import type { GameMeta } from "@/types/game";

export function GameCard({ game }: { game: GameMeta }) {
  return (
    <Link
      href={`/games/${game.id}`}
      className="group relative aspect-square overflow-hidden rounded-2xl shadow-sm transition-all duration-200 hover:scale-[1.03] hover:shadow-lg"
    >
      {/* Full-bleed illustration */}
      <div className="absolute inset-0" style={{ background: game.color }}>
        <GameLogo id={game.id} />
      </div>

      {/* Bottom gradient + name */}
      <div className="absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/55 to-transparent pb-3 pt-10">
        <span className="text-sm font-semibold tracking-wide text-white drop-shadow">
          {game.name}
        </span>
      </div>
    </Link>
  );
}
