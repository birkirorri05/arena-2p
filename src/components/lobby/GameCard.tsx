import Link from "next/link";
import { cn } from "@/lib/utils";
import type { GameMeta } from "@/types/game";

const TAG_COLORS: Record<string, string> = {
  board:    "bg-blue-900/50 text-blue-300",
  card:     "bg-purple-900/50 text-purple-300",
  strategy: "bg-green-900/50 text-green-300",
  action:   "bg-red-900/50 text-red-300",
  classic:  "bg-yellow-900/50 text-yellow-300",
  fighting: "bg-orange-900/50 text-orange-300",
  arcade:   "bg-pink-900/50 text-pink-300",
};

export function GameCard({ game }: { game: GameMeta }) {
  return (
    <Link
      href={`/games/${game.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-arena-border bg-arena-surface transition-all hover:border-white/20 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5"
    >
      {/* Coloured banner with logo */}
      <div className={cn(
        "flex h-24 items-center justify-center bg-gradient-to-br",
        game.color,
      )}>
        <span className="text-5xl drop-shadow-lg select-none">{game.logo}</span>
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold text-arena-text group-hover:text-white transition-colors">
            {game.name}
          </h3>
          <span className="shrink-0 text-xs text-arena-text-muted">~{game.estimatedMinutes}m</span>
        </div>

        <p className="text-xs text-arena-text-muted leading-relaxed">{game.description}</p>

        <div className="flex flex-wrap gap-1 mt-1">
          {game.tags.map((tag) => (
            <span key={tag} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", TAG_COLORS[tag])}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
