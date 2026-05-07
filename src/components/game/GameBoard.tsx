"use client";

import dynamic from "next/dynamic";
import { GAME_REGISTRY } from "@/lib/games/registry";
import { useGameStore } from "@/store/gameStore";
import { Button } from "@/components/ui/Button";
import { PlayerBar } from "./PlayerBar";
import type { GameRoom, GamePlayer } from "@/types/game";

interface GameBoardProps {
  room: GameRoom;
  players: GamePlayer[];
  onResign: () => void;
  onStart: () => void;
}

// Games are loaded lazily — each game component can be large (canvas, assets)
const GAME_COMPONENTS: Record<string, React.ComponentType<{ room: GameRoom }>> = {
  chess: dynamic(() => import("@/components/games/chess/ChessBoard")),
  wordgrid: dynamic(() => import("@/components/games/scrabble/ScrabbleBoard")),
  backgammon: dynamic(() => import("@/components/games/backgammon/BackgammonBoard")),
  go: dynamic(() => import("@/components/games/go/GoBoard")),
  checkers: dynamic(() => import("@/components/games/checkers/CheckersBoard")),
  fourinarow: dynamic(() => import("@/components/games/connect4/Connect4Board")),
  tictactoe: dynamic(() => import("@/components/games/tictactoe/TicTacToeBoard")),
  reversi: dynamic(() => import("@/components/games/reversi/ReversiBoard")),
  mancala: dynamic(() => import("@/components/games/mancala/MancalaBoard")),
  seabattle: dynamic(() => import("@/components/games/battleship/BattleshipBoard")),
  war: dynamic(() => import("@/components/games/war/WarBoard")),
  blackjack: dynamic(() => import("@/components/games/blackjack/BlackjackBoard")),
  wildcards: dynamic(() => import("@/components/games/wildcards/WildCardsBoard")),
  crazyeights: dynamic(() => import("@/components/games/crazyeights/CrazyEightsBoard")),
};

function ComingSoon({ room }: { room: GameRoom }) {
  const meta = GAME_REGISTRY[room.gameId];
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex gap-1 text-5xl select-none">
        {["🂡","🂱","🃁","🃑"].map((c) => (
          <span key={c} className="drop-shadow">{c}</span>
        ))}
      </div>
      <h3 className="text-xl font-semibold text-arena-text">{meta.name}</h3>
      <p className="text-sm text-arena-text-muted max-w-xs">{meta.description}</p>
      <span className="rounded-full border border-arena-accent/40 bg-arena-accent/10 px-3 py-1 text-xs font-medium text-arena-accent">
        Coming soon
      </span>
    </div>
  );
}

export function GameBoard({ room, players, onResign, onStart }: GameBoardProps) {
  const myId = useGameStore((s) => s.myPlayerId);
  const GameComponent = GAME_COMPONENTS[room.gameId];
  const meta = GAME_REGISTRY[room.gameId];

  const isHost = room.hostId === myId;
  const canStart = room.status === "waiting"
    && isHost
    && players.length >= room.minPlayers
    && players.length < room.maxPlayers;

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
          {room.status === "playing" && (
            <Button variant="danger" size="sm" onClick={onResign}>
              Resign
            </Button>
          )}
        </div>
      </div>

      {room.status === "waiting" && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-arena-border bg-arena-surface/50 py-4">
          <p className="text-sm text-arena-text-muted">
            {players.length}/{room.maxPlayers} players joined — share the room code to invite more.
          </p>
          {canStart && (
            <Button onClick={onStart} className="px-6">
              Start game ({players.length} players)
            </Button>
          )}
        </div>
      )}

      <PlayerBar players={players} minPlayers={room.minPlayers} maxPlayers={room.maxPlayers} />

      <div className="rounded-xl border border-arena-border bg-arena-surface p-4">
        {GameComponent ? (
          <GameComponent room={room} />
        ) : (
          <ComingSoon room={room} />
        )}
      </div>
    </div>
  );
}
