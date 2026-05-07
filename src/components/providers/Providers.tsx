"use client";

import { useEffect, type ReactNode } from "react";
import { useSocket } from "@/hooks/useSocket";
import { LoginModal } from "@/components/auth/LoginModal";
import { useGameStore } from "@/store/gameStore";

// Single owner of the socket connection and global modals.
// Moving useSocket() here ensures event listeners are registered
// exactly once, regardless of which pages the user navigates to.
export function Providers({ children }: { children: ReactNode }) {
  const hydrate = useGameStore((s) => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);
  useSocket();
  return (
    <>
      <LoginModal />
      {children}
    </>
  );
}
