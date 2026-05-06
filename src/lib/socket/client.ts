import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@/types/socket";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

// In dev the Next.js rewrite can't handle socket.io's trailing-slash polling
// requests (308 redirect), so connect directly. In production, same origin.
const SOCKET_URL = process.env.NODE_ENV === "development" ? "http://localhost:3001" : "";

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      path: "/socket.io",
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(playerId: string, playerName: string): AppSocket {
  const s = getSocket();
  s.auth = { playerId, playerName };
  s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
