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
};

export function GameBoard({ room, players, onResign }: GameBoardProps) {
  const GameComponent = GAME_COMPONENTS[room.gameId];
  const meta = GAME_REGISTRY[room.gameId];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-arena-text">{meta.name}</h2>
        <Button variant="danger" size="sm" onClick={onResign}>
          Resign
        </Button>
      </div>

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
