import type { GamePlayer } from "@/types/game";
import { cn } from "@/lib/utils";

interface PlayerBarProps {
  players: GamePlayer[];
}

export function PlayerBar({ players }: PlayerBarProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-arena-border bg-arena-surface px-4 py-3">
      {players.map((player) => (
        <div key={player.id} className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              player.connected ? "bg-green-400" : "bg-red-400"
            )}
          />
          <span className="text-sm font-medium text-arena-text">{player.name}</span>
          <span className="text-xs text-arena-text-muted capitalize">({player.slot})</span>
        </div>
      ))}

      {players.length < 2 && (
        <span className="text-sm text-arena-text-muted animate-pulse">
          Waiting for opponent…
        </span>
      )}
    </div>
  );
}
