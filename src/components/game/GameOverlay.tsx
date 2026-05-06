"use client";

import { Button } from "@/components/ui/Button";
import { useGameStore } from "@/store/gameStore";
import type { GameResult } from "@/types/socket";

interface GameOverlayProps {
  result: GameResult;
  onRematch: () => void;
  onLeave: () => void;
}

export function GameOverlay({ result, onRematch, onLeave }: GameOverlayProps) {
  const myId = useGameStore((s) => s.myPlayerId);
  const isWinner = result.winnerId === myId;
  const isDraw = result.winnerId === null;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-arena-bg/80 backdrop-blur-sm">
      <div className="rounded-xl border border-arena-border bg-arena-surface p-8 text-center space-y-4 shadow-2xl">
        <h2 className="text-3xl font-bold text-arena-text">
          {isDraw ? "Draw!" : isWinner ? "You won!" : "You lost"}
        </h2>
        <p className="text-arena-text-muted capitalize">
          {result.reason.replace(/_/g, " ")}
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button onClick={onRematch}>Rematch</Button>
          <Button variant="ghost" onClick={onLeave}>
            Leave
          </Button>
        </div>
      </div>
    </div>
  );
}
