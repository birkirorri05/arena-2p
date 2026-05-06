"use client";

import { useState } from "react";
import { GAMES } from "@/lib/games/registry";
import { GameCard } from "./GameCard";
import type { GameTag } from "@/types/game";

const ALL_TAGS: GameTag[] = ["board", "card", "strategy", "action", "classic", "fighting", "arcade"];

export function GameGrid() {
  const [activeTag, setActiveTag] = useState<GameTag | null>(null);

  const filtered = activeTag ? GAMES.filter((g) => g.tags.includes(activeTag)) : GAMES;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTag(null)}
          className={`rounded-full border px-4 py-1 text-sm transition-colors ${
            !activeTag
              ? "border-arena-accent bg-arena-accent text-white"
              : "border-arena-border text-arena-text-muted hover:border-arena-accent hover:text-arena-text"
          }`}
        >
          All
        </button>
        {ALL_TAGS.map((tag) => (
          <button
            key={tag}
            onClick={() => setActiveTag(tag === activeTag ? null : tag)}
            className={`rounded-full border px-4 py-1 text-sm capitalize transition-colors ${
              activeTag === tag
                ? "border-arena-accent bg-arena-accent text-white"
                : "border-arena-border text-arena-text-muted hover:border-arena-accent hover:text-arena-text"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </div>
  );
}
