import Link from "next/link";
import { GameLogo } from "./GameLogo";
import type { GameMeta } from "@/types/game";

export function GameCard({ game }: { game: GameMeta }) {
  return (
    <Link
      href={`/games/${game.id}`}
      className="group relative aspect-square overflow-hidden rounded-xl transition-all duration-200 hover:scale-[1.03] hover:shadow-xl hover:shadow-black/40 hover:ring-2 hover:ring-arena-accent/50"
    >
      {/* Illustration */}
      <div className="absolute inset-0" style={{ background: game.color }}>
        <GameLogo id={game.id} />
      </div>

      {/* Name label */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent pb-3 pt-12 text-center">
        <span className="text-sm font-semibold text-white drop-shadow-sm tracking-wide">
          {game.name}
        </span>
      </div>
    </Link>
  );
}
