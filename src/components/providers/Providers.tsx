"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, type ReactNode } from "react";
import { useSocket } from "@/hooks/useSocket";
import { LoginModal } from "@/components/auth/LoginModal";
import { useGameStore } from "@/store/gameStore";

// Syncs the NextAuth session into Zustand so the socket and game
// components can read playerId/playerName without touching the session directly.
function SessionSync() {
  const { data: session, status } = useSession();
  const setMyPlayer = useGameStore((s) => s.setMyPlayer);
  const reset = useGameStore((s) => s.reset);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      setMyPlayer(session.user.id, session.user.name ?? "Player");
    } else if (status === "unauthenticated") {
      reset();
    }
  }, [status, session?.user?.id, session?.user?.name, setMyPlayer, reset]);

  return null;
}

// SocketMount is kept separate so it only runs after the session is synced.
function SocketMount() {
  useSocket();
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SessionSync />
      <SocketMount />
      <LoginModal />
      {children}
    </SessionProvider>
  );
}
