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

export const useGameStore = create<GameState>((set) => ({
  room: null,
  players: [],
  moves: [],
  result: null,
  myPlayerId: null,
  myPlayerName: "",

  setRoom: (room) =>
    set((state) => {
      const isNewRoom = state.room?.id !== room.id;
      const isRematch = !!state.result && room.status === "playing";
      return {
        room,
        // Clear moves/result when entering a new room or starting a rematch
        ...(isNewRoom || isRematch ? { result: null, moves: [] } : {}),
      };
    }),
  setPlayers: (players) => set({ players }),
  addMove: (move) => set((s) => ({ moves: [...s.moves, move] })),
  setResult: (result) => set({ result }),
  setMyPlayer: (id, name) => set({ myPlayerId: id, myPlayerName: name }),
  reset: () =>
    set({ room: null, players: [], moves: [], result: null }),
}));
