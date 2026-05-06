"use client";

import { useState } from "react";
import { GAMES } from "@/lib/games/registry";
import { GameCard } from "./GameCard";
import type { GameTag } from "@/types/game";

const ALL_TAGS: GameTag[] = ["board", "strategy", "classic", "card", "action", "fighting", "arcade"];

export function GameGrid() {
  const [activeTag, setActiveTag] = useState<GameTag | null>(null);
  const filtered = activeTag ? GAMES.filter((g) => g.tags.includes(activeTag)) : GAMES;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {([null, ...ALL_TAGS] as const).map((tag) => (
          <button
            key={tag ?? "all"}
            onClick={() => setActiveTag(tag)}
            className={`rounded-md px-3.5 py-1 text-sm font-medium capitalize transition-colors ${
              activeTag === tag
                ? "bg-arena-accent text-white"
                : "bg-arena-surface text-arena-text-muted hover:text-arena-text"
            }`}
          >
            {tag ?? "All games"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
}
