import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "../src/types/socket";
import type { GameRoom, GameMove } from "../src/types/game";

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  httpServer,
  {
    cors: { origin: "http://localhost:3000", credentials: true },
  }
);

// In-memory store — replace with Redis for production
const rooms = new Map<string, GameRoom>();
const playerNames = new Map<string, string>(); // playerId → name

io.use((socket, next) => {
  const { playerId, playerName } = socket.handshake.auth as SocketData;
  if (!playerId) return next(new Error("Missing playerId"));
  socket.data.playerId = playerId;
  socket.data.playerName = playerName ?? "Guest";
  next();
});

io.on("connection", (socket) => {
  const { playerId, playerName } = socket.data;
  playerNames.set(playerId, playerName);

  socket.on("room:create", (gameId, callback) => {
    const room: GameRoom = {
      id: uuidv4().slice(0, 8).toUpperCase(),
      gameId,
      hostId: playerId,
      guestId: null,
      status: "waiting",
      createdAt: Date.now(),
      state: null,
    };
    rooms.set(room.id, room);
    socket.join(room.id);
    callback(room);
    io.to(room.id).emit("room:players", getPlayers(room));
  });

  socket.on("room:join", (roomId, callback) => {
    const room = rooms.get(roomId);
    if (!room) return callback(null);

    // Reconnection — host or guest already in this room
    if (room.hostId === playerId || room.guestId === playerId) {
      socket.join(roomId);
      socket.emit("room:players", getPlayers(room));
      return callback(room);
    }

    // New guest joining
    if (room.status !== "waiting" || room.guestId) {
      return callback(null);
    }
    room.guestId = playerId;
    room.status = "playing";
    socket.join(roomId);
    io.to(roomId).emit("room:updated", room);
    io.to(roomId).emit("room:players", getPlayers(room));
    callback(room);
  });

  socket.on("room:leave", (roomId) => {
    handleLeave(socket, roomId);
  });

  socket.on("game:move", (roomId, move: GameMove) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== "playing") return;
    socket.to(roomId).emit("game:move", move);
  });

  socket.on("game:resign", (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const winnerId = room.hostId === playerId ? room.guestId : room.hostId;
    room.status = "finished";
    io.to(roomId).emit("game:over", { winnerId, reason: "resignation" });
  });

  socket.on("game:rematch", (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;
    // Swap sides and reset state
    const newRoom: GameRoom = {
      ...room,
      hostId: room.guestId ?? room.hostId,
      guestId: room.hostId,
      status: "playing",
      state: null,
    };
    rooms.set(roomId, newRoom);
    io.to(roomId).emit("room:updated", newRoom);
  });

  socket.on("disconnect", () => {
    for (const [roomId, room] of rooms) {
      if (room.hostId === playerId || room.guestId === playerId) {
        if (room.status === "playing") {
          const winnerId = room.hostId === playerId ? room.guestId : room.hostId;
          io.to(roomId).emit("game:over", { winnerId, reason: "disconnect" });
          room.status = "abandoned";
        }
        io.to(roomId).emit("player:disconnected", playerId);
      }
    }
  });

  function handleLeave(
    sock: typeof socket,
    roomId: string
  ) {
    sock.leave(roomId);
    const room = rooms.get(roomId);
    if (!room) return;
    io.to(roomId).emit("player:disconnected", playerId);
  }

  function getPlayers(room: GameRoom) {
    return [
      { id: room.hostId, name: playerNames.get(room.hostId) ?? "Host", slot: "host" as const, connected: true },
      ...(room.guestId
        ? [{ id: room.guestId, name: playerNames.get(room.guestId) ?? "Guest", slot: "guest" as const, connected: true }]
        : []),
    ];
  }
});

const PORT = process.env.SOCKET_PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket server listening on :${PORT}`);
});
