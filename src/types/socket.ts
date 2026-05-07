import type { GameId, GameMove, GameRoom, GamePlayer } from "./game";

// ── Client → Server ──────────────────────────────────────────────────────────
export interface ClientToServerEvents {
  "room:create": (
    gameId: GameId,
    opts: { minPlayers: number; maxPlayers: number },
    callback: (room: GameRoom) => void
  ) => void;
  "room:join": (roomId: string, callback: (room: GameRoom | null) => void) => void;
  "room:leave": (roomId: string) => void;
  "game:move": (roomId: string, move: GameMove) => void;
  "game:resign": (roomId: string) => void;
  "game:rematch": (roomId: string) => void;
  "game:start": (roomId: string) => void;
}

// ── Server → Client ──────────────────────────────────────────────────────────
export interface ServerToClientEvents {
  "room:updated": (room: GameRoom) => void;
  "room:players": (players: GamePlayer[]) => void;
  "game:move": (move: GameMove) => void;
  "game:state": (state: unknown) => void;
  "game:over": (result: GameResult) => void;
  "player:connected": (player: GamePlayer) => void;
  "player:disconnected": (playerId: string) => void;
  error: (message: string) => void;
}

export interface GameResult {
  winnerId: string | null;
  reason: string;
}

export interface InterServerEvents {}
export interface SocketData {
  playerId: string;
  playerName: string;
}
