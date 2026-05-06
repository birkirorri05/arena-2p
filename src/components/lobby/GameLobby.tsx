"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRoom } from "@/hooks/useRoom";
import { Button } from "@/components/ui/Button";
import type { GameMeta } from "@/types/game";

// Socket is connected globally by Providers. No useSocket() needed here.
export function GameLobby({ game }: { game: GameMeta }) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading]   = useState<"create" | "join" | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const { createRoom, joinRoom } = useRoom();

  async function handleCreate() {
    setLoading("create"); setError(null);
    try {
      router.push(`/room/${await createRoom(game.id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setLoading(null); }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setLoading("join"); setError(null);
    try {
      const code = joinCode.trim().toUpperCase();
      const ok = await joinRoom(code);
      if (ok) router.push(`/room/${code}`);
      else setError("Room not found or already full.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setLoading(null); }
  }

  return (
    <div className="mx-auto max-w-sm py-12 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-arena-text">{game.name}</h1>
      </div>

      <div className="rounded-xl border border-arena-border bg-arena-surface p-5 space-y-3">
        <p className="text-sm font-semibold text-arena-text">New game</p>
        <Button className="w-full" onClick={handleCreate} disabled={!!loading}>
          {loading === "create" ? "Creating…" : "Create room"}
        </Button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <div className="rounded-xl border border-arena-border bg-arena-surface p-5 space-y-3">
        <p className="text-sm font-semibold text-arena-text">Join a room</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            className="flex-1 rounded-lg border border-arena-border bg-arena-bg px-3 py-2 text-sm text-arena-text placeholder:text-arena-text-muted focus:outline-none focus:ring-2 focus:ring-arena-accent"
          />
          <Button onClick={handleJoin} disabled={!!loading || !joinCode.trim()}>
            {loading === "join" ? "…" : "Join"}
          </Button>
        </div>
      </div>
    </div>
  );
}
