"use client";

import dynamic from "next/dynamic";
import { GAME_REGISTRY } from "@/lib/games/registry";
import { Button } from "@/components/ui/Button";
import { PlayerBar } from "./PlayerBar";
import type { GameRoom, GamePlayer } from "@/types/game";

interface GameBoardProps {
  room: GameRoom;
  players: GamePlayer[];
  onResign: () => void;
}

// Games are loaded lazily — each game component can be large (canvas, assets)
const GAME_COMPONENTS: Record<string, React.ComponentType<{ room: GameRoom }>> = {
  chess: dynamic(() => import("@/components/games/chess/ChessBoard")),
  scrabble: dynamic(() => import("@/components/games/scrabble/ScrabbleBoard")),
  backgammon: dynamic(() => import("@/components/games/backgammon/BackgammonBoard")),
  go: dynamic(() => import("@/components/games/go/GoBoard")),
  battleship: dynamic(() => import("@/components/games/battleship/BattleshipBoard")),
  uno: dynamic(() => import("@/components/games/uno/UnoGame")),
  pong: dynamic(() => import("@/components/games/pong/PongCanvas")),
  streetfighter: dynamic(() => import("@/components/games/streetfighter/FightCanvas")),
  checkers: dynamic(() => import("@/components/games/checkers/CheckersBoard")),
  connect4: dynamic(() => import("@/components/games/connect4/Connect4Board")),
  tictactoe: dynamic(() => import("@/components/games/tictactoe/TicTacToeBoard")),
  reversi: dynamic(() => import("@/components/games/reversi/ReversiBoard")),
  mancala: dynamic(() => import("@/components/games/mancala/MancalaBoard")),
};

export function GameBoard({ room, players, onResign }: GameBoardProps) {
  const GameComponent = GAME_COMPONENTS[room.gameId];
  const meta = GAME_REGISTRY[room.gameId];

  function copyRoomId() {
    navigator.clipboard.writeText(room.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-arena-text">{meta.name}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-arena-text-muted">Room</span>
          <code className="rounded bg-arena-bg px-2 py-1 font-mono text-sm text-arena-text">
            {room.id}
          </code>
          <Button variant="ghost" size="sm" onClick={copyRoomId}>
            Copy
          </Button>
          <Button variant="danger" size="sm" onClick={onResign}>
            Resign
          </Button>
        </div>
      </div>

      {room.status === "waiting" && (
        <p className="text-center text-sm text-arena-text-muted">
          Waiting for opponent — share the room code above to invite them.
        </p>
      )}

      <PlayerBar players={players} />

      <div className="rounded-xl border border-arena-border bg-arena-surface p-4">
        {GameComponent ? (
          <GameComponent room={room} />
        ) : (
          <div className="flex h-64 items-center justify-center text-arena-text-muted">
            Game not yet implemented
          </div>
        )}
      </div>
    </div>
  );
}
