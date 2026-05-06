import type { GameId, GameMeta } from "@/types/game";

const g = (a: string, b: string) => `linear-gradient(135deg,${a},${b})`;

export const GAME_REGISTRY: Record<GameId, GameMeta> = {
  chess: {
    id: "chess", name: "Chess",
    description: "The classic game of kings. Checkmate your opponent.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 30,
    tags: ["board", "strategy", "classic"],
    component: "chess/ChessBoard",
    logo: "♟️", color: g("#334155", "#0f172a"),
  },
  scrabble: {
    id: "scrabble", name: "Scrabble",
    description: "Build words, rack up points.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 45,
    tags: ["board", "classic"],
    component: "scrabble/ScrabbleBoard",
    logo: "🔤", color: g("#b45309", "#78350f"),
  },
  backgammon: {
    id: "backgammon", name: "Backgammon",
    description: "Race your pieces home. Roll dice, outmanoeuvre your rival.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 20,
    tags: ["board", "classic", "strategy"],
    component: "backgammon/BackgammonBoard",
    logo: "🎲", color: g("#92400e", "#451a03"),
  },
  go: {
    id: "go", name: "Go",
    description: "Ancient strategy. Simple rules, infinite depth.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 60,
    tags: ["board", "strategy", "classic"],
    component: "go/GoBoard",
    logo: "⚫", color: g("#44403c", "#1c1917"),
  },
  battleship: {
    id: "battleship", name: "Battleship",
    description: "Hidden fleets, deadly salvos. Sink them all.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 15,
    tags: ["board", "classic"],
    component: "battleship/BattleshipBoard",
    logo: "🚢", color: g("#1e40af", "#0c1a4b"),
  },
  uno: {
    id: "uno", name: "Uno",
    description: "Play cards, draw penalties, shout UNO!",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 15,
    tags: ["card", "classic"],
    component: "uno/UnoGame",
    logo: "🃏", color: g("#dc2626", "#c2410c"),
  },
  pong: {
    id: "pong", name: "Pong",
    description: "The original arcade classic. First to 7 wins.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 5,
    tags: ["arcade", "classic"],
    component: "pong/PongCanvas",
    logo: "🏓", color: g("#0e7490", "#134e4a"),
  },
  streetfighter: {
    id: "streetfighter", name: "Street Fighter",
    description: "Choose your fighter. Land combos. Win the round.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 5,
    tags: ["fighting", "action"],
    component: "streetfighter/FightCanvas",
    logo: "👊", color: g("#b91c1c", "#881337"),
  },
  checkers: {
    id: "checkers", name: "Checkers",
    description: "Jump over your opponent's pieces. King me.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 20,
    tags: ["board", "classic", "strategy"],
    component: "checkers/CheckersBoard",
    logo: "🔴", color: g("#991b1b", "#450a0a"),
  },
  connect4: {
    id: "connect4", name: "Connect 4",
    description: "Drop discs, get four in a row.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 10,
    tags: ["board", "classic"],
    component: "connect4/Connect4Board",
    logo: "🔵", color: g("#1d4ed8", "#312e81"),
  },
  tictactoe: {
    id: "tictactoe", name: "Tic Tac Toe",
    description: "X vs O. Simple, fast, surprisingly competitive.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 2,
    tags: ["board", "classic"],
    component: "tictactoe/TicTacToeBoard",
    logo: "✖️", color: g("#7c3aed", "#4c1d95"),
  },
  reversi: {
    id: "reversi", name: "Reversi",
    description: "Flip your opponent's discs. Control the board.",
    minPlayers: 2, maxPlayers: 2, estimatedMinutes: 20,
    tags: ["board", "strategy", "classic"],
    component: "reversi/ReversiBoard",
    logo: "🟢", color: g("#15803d", "#14532d"),
  },
};

export const GAMES = Object.values(GAME_REGISTRY);
