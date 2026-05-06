import { create } from "zustand";
import type { GameRoom, GameMove, GamePlayer } from "@/types/game";
import type { GameResult } from "@/types/socket";

interface GameState {
  room: GameRoom | null;
  players: GamePlayer[];
  moves: GameMove[];
  result: GameResult | null;
  myPlayerId: string | null;
  myPlayerName: string;

  setRoom: (room: GameRoom) => void;
  setPlayers: (players: GamePlayer[]) => void;
  addMove: (move: GameMove) => void;
  setResult: (result: GameResult) => void;
  setMyPlayer: (id: string, name: string) => void;
  reset: () => void;
}

function loadPlayer(): { myPlayerId: string | null; myPlayerName: string } {
  if (typeof window === "undefined") return { myPlayerId: null, myPlayerName: "" };
  return {
    myPlayerId: localStorage.getItem("arena_player_id"),
    myPlayerName: localStorage.getItem("arena_player_name") ?? "",
  };
}

const { myPlayerId: storedId, myPlayerName: storedName } = loadPlayer();

export const useGameStore = create<GameState>((set) => ({
  room: null,
  players: [],
  moves: [],
  result: null,
  myPlayerId: storedId,
  myPlayerName: storedName,

  setRoom: (room) =>
    set((state) => {
      const isNewRoom = state.room?.id !== room.id;
      const isRematch = !!state.result && room.status === "playing";
      return {
        room,
        ...(isNewRoom || isRematch ? { result: null, moves: [] } : {}),
      };
    }),
  setPlayers: (players) => set({ players }),
  addMove: (move) => set((s) => ({ moves: [...s.moves, move] })),
  setResult: (result) => set({ result }),
  setMyPlayer: (id, name) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("arena_player_id", id);
      localStorage.setItem("arena_player_name", name);
    }
    set({ myPlayerId: id, myPlayerName: name });
  },
  reset: () => set({ room: null, players: [], moves: [], result: null }),
}));
