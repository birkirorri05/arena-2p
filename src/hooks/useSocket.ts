"use client";

import { useEffect, useRef } from "react";
import { connectSocket, disconnectSocket, getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";

export function useSocket() {
  const connected = useRef(false);
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const myPlayerName = useGameStore((s) => s.myPlayerName);
  const { setRoom, setPlayers, addMove, setResult } = useGameStore();

  useEffect(() => {
    if (!myPlayerId || connected.current) return;

    const socket = connectSocket(myPlayerId, myPlayerName);
    connected.current = true;

    socket.on("room:updated", setRoom);
    socket.on("room:players", setPlayers);
    socket.on("game:move", addMove);
    socket.on("game:over", setResult);

    return () => {
      socket.off("room:updated", setRoom);
      socket.off("room:players", setPlayers);
      socket.off("game:move", addMove);
      socket.off("game:over", setResult);
      disconnectSocket();
      connected.current = false;
    };
  }, [myPlayerId, myPlayerName, setRoom, setPlayers, addMove, setResult]);

  return getSocket();
}
