"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useGameStore } from "@/store/gameStore";

export function LoginModal() {
  const myPlayerId = useGameStore((s) => s.myPlayerId);
  const hydrated   = useGameStore((s) => s.hydrated);
  const setMyPlayer  = useGameStore((s) => s.setMyPlayer);
  const [name, setName] = useState("");

  useEffect(() => {
    setName(localStorage.getItem("arena_player_name") ?? "");
  }, []);

  if (!hydrated || myPlayerId) return null;

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    setMyPlayer(uuidv4(), trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-arena-border bg-arena-surface p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <span className="text-5xl">♟</span>
          <h2 className="mt-3 text-2xl font-bold text-arena-text">Welcome to Arena 2P</h2>
          <p className="mt-1 text-sm text-arena-text-muted">Choose a username to start playing</p>
        </div>

        <input
          type="text"
          placeholder="Username"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          maxLength={20}
          autoFocus
          className="mb-3 w-full rounded-lg border border-arena-border bg-arena-bg px-4 py-2.5 text-arena-text placeholder:text-arena-text-muted focus:outline-none focus:ring-2 focus:ring-arena-accent"
        />

        <button
          onClick={submit}
          disabled={name.trim().length < 2}
          className="w-full rounded-md bg-arena-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-arena-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start playing →
        </button>
      </div>
    </div>
  );
}
