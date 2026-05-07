"use client";

import { useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { GAME_REGISTRY } from "@/lib/games/registry";
import type { GameId } from "@/types/game";

export function useRoom() {
  const { room, players, result } = useGameStore();

  const createRoom = useCallback(
    (gameId: GameId): Promise<string> => {
      const meta = GAME_REGISTRY[gameId];
      return new Promise((resolve, reject) => {
        getSocket()
          .timeout(8000)
          .emit("room:create", gameId, { minPlayers: meta.minPlayers, maxPlayers: meta.maxPlayers }, (err, newRoom) => {
            if (err) return reject(new Error("Could not reach the game server. Is it running?"));
            if (!newRoom) return reject(new Error("Failed to create room"));
            useGameStore.getState().setRoom(newRoom);
            resolve(newRoom.id);
          });
      });
    },
    []
  );

  const joinRoom = useCallback(
    (roomId: string): Promise<boolean> =>
      new Promise((resolve, reject) => {
        getSocket()
          .timeout(8000)
          .emit("room:join", roomId, (err, joined) => {
            if (err) return reject(new Error("Could not reach the game server. Is it running?"));
            if (joined) useGameStore.getState().setRoom(joined);
            resolve(!!joined);
          });
      }),
    []
  );

  const leaveRoom = useCallback(() => {
    if (room) {
      getSocket().emit("room:leave", room.id);
      useGameStore.getState().reset();
    }
  }, [room]);

  const resign = useCallback(() => {
    if (room) getSocket().emit("game:resign", room.id);
  }, [room]);

  const rematch = useCallback(() => {
    if (room) getSocket().emit("game:rematch", room.id);
  }, [room]);

  const startGame = useCallback(() => {
    if (room) getSocket().emit("game:start", room.id);
  }, [room]);

  return { room, players, result, createRoom, joinRoom, leaveRoom, resign, rematch, startGame };
}
