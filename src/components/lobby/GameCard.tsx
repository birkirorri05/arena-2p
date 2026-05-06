import Link from "next/link";
import { cn } from "@/lib/utils";
import type { GameMeta } from "@/types/game";

interface GameCardProps {
  game: GameMeta;
}

const TAG_COLORS: Record<string, string> = {
  board: "bg-blue-900/50 text-blue-300",
  card: "bg-purple-900/50 text-purple-300",
  strategy: "bg-green-900/50 text-green-300",
  action: "bg-red-900/50 text-red-300",
  classic: "bg-yellow-900/50 text-yellow-300",
  fighting: "bg-orange-900/50 text-orange-300",
  arcade: "bg-pink-900/50 text-pink-300",
};

export function GameCard({ game }: GameCardProps) {
  return (
    <Link
      href={`/games/${game.id}`}
      className="group relative flex flex-col gap-3 rounded-xl border border-arena-border bg-arena-surface p-5 transition-all hover:border-arena-accent hover:shadow-lg hover:shadow-arena-accent/10"
    >
      <div className="flex items-start justify-between">
        <h3 className="text-lg font-semibold text-arena-text group-hover:text-arena-accent transition-colors">
          {game.name}
        </h3>
        <span className="text-xs text-arena-text-muted">~{game.estimatedMinutes}m</span>
      </div>

      <p className="text-sm text-arena-text-muted leading-relaxed">{game.description}</p>

      <div className="flex flex-wrap gap-1.5 mt-auto">
        {game.tags.map((tag) => (
          <span
            key={tag}
            className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TAG_COLORS[tag])}
          >
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}
