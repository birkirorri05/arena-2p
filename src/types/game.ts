export type GameId =
  | "chess"
  | "scrabble"
  | "backgammon"
  | "go"
  | "checkers"
  | "connect4"
  | "tictactoe"
  | "reversi"
  | "mancala"
  | "battleship"
  // card games
  | "war"
  | "blackjack"
  | "uno"
  | "crazyeights"
  | "gofish"
  | "poker"
  | "snap"
  | "hearts"
  | "rummy"
  // multi-player extras
  | "yahtzee"
  | "liarsdice"
  | "dominoes";

export interface GameMeta {
  id: GameId;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  estimatedMinutes: number;
  tags: GameTag[];
  /** Relative path to the game's board/canvas component */
  component: string;
  /** CSS gradient for the card banner */
  color: string;
}

export type GameTag =
  | "board"
  | "card"
  | "strategy"
  | "action"
  | "classic"
  | "fighting"
  | "arcade"
  | "dice";

export type GameStatus = "waiting" | "playing" | "finished" | "abandoned";

export interface GameRoom {
  id: string;
  gameId: GameId;
  hostId: string;
  /** All players in join order; playerIds[0] is always the host. */
  playerIds: string[];
  minPlayers: number;
  maxPlayers: number;
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

export type PlayerSlot = "host" | "p2" | "p3" | "p4" | "p5" | "p6";

export interface GamePlayer {
  id: string;
  name: string;
  slot: PlayerSlot;
  connected: boolean;
}
