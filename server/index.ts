import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "../src/types/socket";
import type { GameRoom, GameMove, PlayerSlot } from "../src/types/game";

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

const SLOTS: PlayerSlot[] = ["host", "p2", "p3", "p4", "p5", "p6"];

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

  socket.on("room:create", (gameId, { minPlayers, maxPlayers }, callback) => {
    const room: GameRoom = {
      id: uuidv4().slice(0, 8).toUpperCase(),
      gameId,
      hostId: playerId,
      playerIds: [playerId],
      minPlayers,
      maxPlayers,
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

    // Reconnection — player already in this room
    if (room.playerIds.includes(playerId)) {
      socket.join(roomId);
      socket.emit("room:players", getPlayers(room));
      return callback(room);
    }

    // Room full or already started
    if (room.status !== "waiting" || room.playerIds.length >= room.maxPlayers) {
      return callback(null);
    }

    room.playerIds.push(playerId);
    socket.join(roomId);

    // Auto-start when the room reaches capacity
    if (room.playerIds.length >= room.maxPlayers) {
      room.status = "playing";
    }

    io.to(roomId).emit("room:updated", room);
    io.to(roomId).emit("room:players", getPlayers(room));
    callback(room);
  });

  // Host can start early once minPlayers is reached
  socket.on("game:start", (roomId) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== playerId) return;
    if (room.status !== "waiting" || room.playerIds.length < room.minPlayers) return;
    room.status = "playing";
    io.to(roomId).emit("room:updated", room);
  });

  socket.on("room:leave", (roomId) => {
    socket.leave(roomId);
    const room = rooms.get(roomId);
    if (!room) return;
    io.to(roomId).emit("player:disconnected", playerId);
  });

  socket.on("game:move", (roomId, move: GameMove) => {
    const room = rooms.get(roomId);
    if (!room || room.status !== "playing") return;
    socket.to(roomId).emit("game:move", move);
  });

  socket.on("game:resign", (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const others = room.playerIds.filter((id) => id !== playerId);
    const winnerId = others.length === 1 ? others[0] : null;
    room.status = "finished";
    io.to(roomId).emit("game:over", { winnerId, reason: "resignation" });
  });

  socket.on("game:rematch", (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;
    // Rotate player order so a different player hosts
    const rotated = [...room.playerIds.slice(1), room.playerIds[0]];
    const newRoom: GameRoom = {
      ...room,
      hostId: rotated[0],
      playerIds: rotated,
      status: "playing",
      state: null,
    };
    rooms.set(roomId, newRoom);
    io.to(roomId).emit("room:updated", newRoom);
    io.to(roomId).emit("room:players", getPlayers(newRoom));
  });

  socket.on("disconnect", () => {
    for (const [roomId, room] of rooms) {
      if (!room.playerIds.includes(playerId)) continue;
      if (room.status === "playing") {
        const others = room.playerIds.filter((id) => id !== playerId);
        const winnerId = others.length === 1 ? others[0] : null;
        io.to(roomId).emit("game:over", { winnerId, reason: "disconnect" });
        room.status = "abandoned";
      }
      io.to(roomId).emit("player:disconnected", playerId);
    }
  });

  function getPlayers(room: GameRoom) {
    return room.playerIds.map((id, i) => ({
      id,
      name: playerNames.get(id) ?? `Player ${i + 1}`,
      slot: SLOTS[i] ?? ("p6" as PlayerSlot),
      connected: true,
    }));
  }
});

const PORT = process.env.SOCKET_PORT ?? 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket server listening on :${PORT}`);
});
