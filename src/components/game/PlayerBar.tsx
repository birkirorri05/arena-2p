import type { GamePlayer } from "@/types/game";
import { cn } from "@/lib/utils";

interface PlayerBarProps {
  players: GamePlayer[];
  minPlayers?: number;
  maxPlayers?: number;
}

function slotLabel(slot: string, index: number): string {
  if (slot === "host") return "Host";
  return `Player ${index + 1}`;
}

export function PlayerBar({ players, minPlayers = 2, maxPlayers = 2 }: PlayerBarProps) {
  const waiting = players.length < minPlayers;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-arena-border bg-arena-surface px-4 py-3">
      {players.map((player, i) => (
        <div key={player.id} className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", player.connected ? "bg-green-400" : "bg-red-400")} />
          <span className="text-sm font-medium text-arena-text">{player.name}</span>
          <span className="text-xs text-arena-text-muted">({slotLabel(player.slot, i)})</span>
        </div>
      ))}

      {waiting && (
        <span className="text-sm text-arena-text-muted animate-pulse ml-auto">
          {players.length}/{maxPlayers} — waiting for players…
        </span>
      )}
    </div>
  );
}
