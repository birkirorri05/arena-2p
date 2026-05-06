import type { GameId, GameMeta } from "@/types/game";

const g = (a: string, b: string) => `linear-gradient(135deg,${a},${b})`;

export const GAME_REGISTRY: Record<GameId, GameMeta> = {
  chess: {
    id: "chess", name: "Chess",
    description: "The classic game of kings. Checkmate your opponent.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 30,
    tags: ["board", "strategy", "classic"],
    component: "chess/ChessBoard",
    color: g("#334155", "#0f172a"),
  },
  scrabble: {
    id: "scrabble", name: "Scrabble",
    description: "Build words, rack up points.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 45,
    tags: ["board", "classic"],
    component: "scrabble/ScrabbleBoard",
    color: g("#b45309", "#78350f"),
  },
  backgammon: {
    id: "backgammon", name: "Backgammon",
    description: "Race your pieces home. Roll dice, outmanoeuvre your rival.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 20,
    tags: ["board", "classic", "strategy"],
    component: "backgammon/BackgammonBoard",
    color: g("#92400e", "#451a03"),
  },
  go: {
    id: "go", name: "Go",
    description: "Ancient strategy. Simple rules, infinite depth.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 60,
    tags: ["board", "strategy", "classic"],
    component: "go/GoBoard",
    color: g("#44403c", "#1c1917"),
  },
  checkers: {
    id: "checkers", name: "Checkers",
    description: "Jump over your opponent's pieces. King me.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 20,
    tags: ["board", "classic", "strategy"],
    component: "checkers/CheckersBoard",
    color: g("#991b1b", "#450a0a"),
  },
  connect4: {
    id: "connect4", name: "Connect 4",
    description: "Drop discs, get four in a row.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 10,
    tags: ["board", "classic"],
    component: "connect4/Connect4Board",
    color: g("#1d4ed8", "#312e81"),
  },
  tictactoe: {
    id: "tictactoe", name: "Tic Tac Toe",
    description: "X vs O. Simple, fast, surprisingly competitive.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 2,
    tags: ["board", "classic"],
    component: "tictactoe/TicTacToeBoard",
    color: g("#7c3aed", "#4c1d95"),
  },
  reversi: {
    id: "reversi", name: "Reversi",
    description: "Flip your opponent's discs. Control the board.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 20,
    tags: ["board", "strategy", "classic"],
    component: "reversi/ReversiBoard",
    color: g("#15803d", "#14532d"),
  },
  mancala: {
    id: "mancala", name: "Mancala",
    description: "Sow seeds, capture pits, fill your store.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 15,
    tags: ["board", "classic", "strategy"],
    component: "mancala/MancalaBoard",
    color: g("#92400e", "#3b1a08"),
  },
};

export const GAMES = Object.values(GAME_REGISTRY);
