"use client";

import { useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { InviteModal } from "@/components/invite/InviteModal";

export function Navbar() {
  const myPlayerName = useGameStore((s) => s.myPlayerName);
  const [showInvite, setShowInvite] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-arena-border bg-arena-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">

          <Link href="/" className="flex items-center gap-1.5 shrink-0">
            <span className="text-lg font-bold text-arena-text">♟</span>
            <span className="text-lg font-bold tracking-tight">
              <span className="text-arena-text">Arena</span>
              <span className="text-arena-accent">2P</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {([["Games", "/games"], ["Leaderboard", "/leaderboard"]] as const).map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-arena-text-muted transition-colors hover:bg-arena-surface hover:text-arena-text"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {myPlayerName && (
              <>
                <button
                  onClick={() => setShowInvite(true)}
                  className="rounded-md bg-arena-accent px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-arena-accent-hover"
                >
                  + Invite
                </button>
                <div className="rounded-md border border-arena-border bg-arena-surface px-3 py-1.5 text-sm font-medium text-arena-text">
                  {myPlayerName}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </>
  );
}
