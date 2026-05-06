"use client";

import type { ReactNode } from "react";
import { useSocket } from "@/hooks/useSocket";
import { LoginModal } from "@/components/auth/LoginModal";

// Single owner of the socket connection and global modals.
// Moving useSocket() here ensures event listeners are registered
// exactly once, regardless of which pages the user navigates to.
export function Providers({ children }: { children: ReactNode }) {
  useSocket();
  return (
    <>
      <LoginModal />
      {children}
    </>
  );
}
