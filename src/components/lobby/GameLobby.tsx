"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRoom } from "@/hooks/useRoom";
import { useSocket } from "@/hooks/useSocket";
import { useGameStore } from "@/store/gameStore";
import { generateGuestName } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { GameMeta } from "@/types/game";
import { v4 as uuidv4 } from "uuid";

interface GameLobbyProps {
  game: GameMeta;
}

export function GameLobby({ game }: GameLobbyProps) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { setMyPlayer } = useGameStore();
  const { createRoom, joinRoom } = useRoom();

  // Initialize player identity on first visit so the socket connects immediately
  useEffect(() => {
    const state = useGameStore.getState();
    if (!state.myPlayerId) {
      setMyPlayer(uuidv4(), generateGuestName());
    }
  }, [setMyPlayer]);

  useSocket(); // connects once myPlayerId is set

  function ensurePlayer() {
    const state = useGameStore.getState();
    if (!state.myPlayerId) {
      const id = uuidv4();
      const name = generateGuestName();
      setMyPlayer(id, name);
      return { id, name };
    }
    return { id: state.myPlayerId, name: state.myPlayerName };
  }

  async function handleCreate() {
    setLoading("create");
    setError(null);
    ensurePlayer();
    try {
      const roomId = await createRoom(game.id);
      router.push(`/room/${roomId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setLoading("join");
    setError(null);
    ensurePlayer();
    try {
      const ok = await joinRoom(joinCode.trim());
      if (ok) router.push(`/room/${joinCode.trim()}`);
      else setError("Room not found or already full.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 py-12">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-arena-text">{game.name}</h1>
        <p className="mt-2 text-arena-text-muted">{game.description}</p>
      </div>

      <Card className="space-y-4">
        <h2 className="font-semibold text-arena-text">Create a game</h2>
        <p className="text-sm text-arena-text-muted">
          Start a new room and share the link with a friend.
        </p>
        <Button className="w-full" onClick={handleCreate} disabled={!!loading}>
          {loading === "create" ? "Creating…" : "Create room"}
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold text-arena-text">Join a game</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Room ID"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            className="flex-1 rounded-lg border border-arena-border bg-arena-bg px-3 py-2 text-sm text-arena-text placeholder:text-arena-text-muted focus:outline-none focus:ring-2 focus:ring-arena-accent"
          />
          <Button onClick={handleJoin} disabled={!!loading || !joinCode.trim()}>
            {loading === "join" ? "Joining…" : "Join"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
