import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@/types/socket";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function getSocket(): AppSocket {
  if (!socket) {
    socket = io({
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
