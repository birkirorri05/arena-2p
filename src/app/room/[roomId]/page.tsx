"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useRoom } from "@/hooks/useRoom";
import { useGameStore } from "@/store/gameStore";
import { getSocket } from "@/lib/socket/client";
import { GameBoard } from "@/components/game/GameBoard";
import { GameOverlay } from "@/components/game/GameOverlay";

// Socket is connected globally by Providers — use getSocket() directly.
export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { room, players, result, resign, rematch, leaveRoom, startGame } = useRoom();

  useEffect(() => {
    if (!roomId || room) return;
    getSocket().emit("room:join", roomId, (joined) => {
      if (joined) useGameStore.getState().setRoom(joined);
    });
  }, [roomId, room]);

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
      <GameBoard room={room} players={players} onResign={resign} onStart={startGame} />
    </div>
  );
}
