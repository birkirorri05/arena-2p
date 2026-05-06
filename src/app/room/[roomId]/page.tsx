"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useRoom } from "@/hooks/useRoom";
import { useSocket } from "@/hooks/useSocket";
import { GameBoard } from "@/components/game/GameBoard";
import { GameOverlay } from "@/components/game/GameOverlay";

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const socket = useSocket();
  const { room, players, result, resign, rematch, leaveRoom } = useRoom();

  useEffect(() => {
    if (roomId && !room) {
      // Reconnect to a room when page is (re)loaded
      socket.emit("room:join", roomId, (joined) => {
        if (joined) useRoom.toString(); // store updates via socket listener
      });
    }
  }, [roomId, room, socket]);

  if (!room) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-arena-text-muted">
        Connecting to room…
      </div>
    );
  }

  return (
    <div className="relative">
      {result && <GameOverlay result={result} onRematch={rematch} onLeave={leaveRoom} />}
      <GameBoard room={room} players={players} onResign={resign} />
    </div>
  );
}
