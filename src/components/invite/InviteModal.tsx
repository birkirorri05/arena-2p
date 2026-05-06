"use client";

import { useState } from "react";
import { useRoom } from "@/hooks/useRoom";
import { GAMES } from "@/lib/games/registry";
import { GameLogo } from "@/components/lobby/GameLogo";
import { cn } from "@/lib/utils";
import type { GameId } from "@/types/game";

interface Props {
  onClose: () => void;
}

export function InviteModal({ onClose }: Props) {
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null);
  const [roomCode, setRoomCode]         = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [copied, setCopied]             = useState(false);
  const { createRoom } = useRoom();

  async function handleCreate() {
    if (!selectedGame) return;
    setLoading(true);
    setError(null);
    try {
      setRoomCode(await createRoom(selectedGame));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!roomCode) return;
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inviteUrl = roomCode ? `${typeof window !== "undefined" ? window.location.origin : ""}/room/${roomCode}` : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-arena-border bg-arena-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {!roomCode ? (
          <>
            <h2 className="text-xl font-bold text-arena-text">Invite a friend</h2>
            <p className="mt-0.5 mb-5 text-sm text-arena-text-muted">Pick a game, then share the link</p>

            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto mb-5 pr-0.5">
              {GAMES.map((game) => (
                <button
                  key={game.id}
                  onClick={() => setSelectedGame(game.id)}
                  className={cn(
                    "relative aspect-square rounded-xl overflow-hidden transition-all duration-150",
                    selectedGame === game.id
                      ? "ring-2 ring-arena-accent scale-[1.05]"
                      : "opacity-55 hover:opacity-90"
                  )}
                >
                  <div className="absolute inset-0" style={{ background: game.color }}>
                    <GameLogo id={game.id} />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent pb-2 pt-6 text-center">
                    <span className="text-[11px] font-semibold text-white leading-tight">{game.name}</span>
                  </div>
                </button>
              ))}
            </div>

            {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-md border border-arena-border py-2 text-sm text-arena-text-muted hover:bg-arena-bg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!selectedGame || loading}
                className="flex-1 rounded-md bg-arena-accent py-2 text-sm font-semibold text-white hover:bg-arena-accent-hover disabled:opacity-40 transition-colors"
              >
                {loading ? "Creating…" : "Create invite"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-5 text-center">
              <h2 className="text-xl font-bold text-arena-text">Room ready!</h2>
              <p className="mt-0.5 text-sm text-arena-text-muted">Share this with your friend</p>
            </div>

            {/* Room code */}
            <div className="rounded-xl border border-arena-border bg-arena-bg px-4 py-5 mb-4 text-center">
              <p className="text-xs text-arena-text-muted mb-1 uppercase tracking-widest">Room code</p>
              <span className="font-mono text-4xl font-bold tracking-[.2em] text-arena-accent">
                {roomCode}
              </span>
            </div>

            {/* Invite link */}
            <div className="flex gap-2 mb-4">
              <input
                readOnly
                value={inviteUrl}
                className="min-w-0 flex-1 rounded-lg border border-arena-border bg-arena-bg px-3 py-2 text-xs text-arena-text-muted font-mono"
              />
              <button
                onClick={handleCopy}
                className={cn(
                  "shrink-0 rounded-md px-4 py-2 text-sm font-semibold transition-colors",
                  copied ? "bg-green-600 text-white" : "bg-arena-accent text-white hover:bg-arena-accent-hover"
                )}
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-md border border-arena-border py-2 text-sm text-arena-text-muted hover:bg-arena-bg transition-colors"
              >
                Done
              </button>
              <a
                href={`/room/${roomCode}`}
                className="flex-1 rounded-md border border-arena-border bg-arena-bg py-2 text-sm text-center font-medium text-arena-text hover:bg-arena-surface transition-colors"
              >
                Go to room →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
