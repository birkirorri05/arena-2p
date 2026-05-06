"use client";

import { useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import type { GameId } from "@/types/game";

export function useRoom() {
  const { room, players, result } = useGameStore();

  const createRoom = useCallback(
    (gameId: GameId): Promise<string> =>
      new Promise((resolve, reject) => {
        getSocket().emit("room:create", gameId, (newRoom) => {
          if (!newRoom) return reject(new Error("Failed to create room"));
          useGameStore.getState().setRoom(newRoom);
          resolve(newRoom.id);
        });
      }),
    []
  );

  const joinRoom = useCallback(
    (roomId: string): Promise<boolean> =>
      new Promise((resolve) => {
        getSocket().emit("room:join", roomId, (joined) => {
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

  return { room, players, result, createRoom, joinRoom, leaveRoom, resign, rematch };
}
