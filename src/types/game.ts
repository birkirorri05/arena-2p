export type GameId =
  | "chess"
  | "scrabble"
  | "backgammon"
  | "go"
  | "checkers"
  | "connect4"
  | "tictactoe"
  | "reversi"
  | "mancala";

export interface GameMeta {
  id: GameId;
  name: string;
  description: string;
  minPlayers: 2;
  maxPlayers: 2;
  estimatedMinutes: number;
  tags: GameTag[];
  /** Relative path to the game's board/canvas component */
  component: string;
  /** CSS gradient for the card banner, e.g. "linear-gradient(135deg,#1e3a5f,#0f172a)" */
  color: string;
}

export type GameTag =
  | "board"
  | "card"
  | "strategy"
  | "action"
  | "classic"
  | "fighting"
  | "arcade";

export type GameStatus = "waiting" | "playing" | "finished" | "abandoned";

export interface GameRoom {
  id: string;
  gameId: GameId;
  hostId: string;
  guestId: string | null;
  status: GameStatus;
  createdAt: number;
  /** Opaque serialised game state — shape differs per game */
  state: unknown;
}

export interface GameMove {
  playerId: string;
  timestamp: number;
  payload: unknown;
}

export type PlayerSlot = "host" | "guest";

export interface GamePlayer {
  id: string;
  name: string;
  slot: PlayerSlot;
  connected: boolean;
}
