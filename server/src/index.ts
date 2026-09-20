import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server } from "socket.io";
import {
  type ClientToServerEvents,
  type ServerToClientEvents,
  type SocketData,
} from "./protocol.ts";
import {
  addPlayer,
  getOrCreateRoom,
  getRoom,
  listPlayers,
  removePlayer,
} from "./rooms.ts";

const PORT = Number(process.env.PORT ?? 4000);
const GYRO_MIN_INTERVAL_MS = 32;
const allowedOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;
  if (allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(origin);
}

function writeCors(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (allowedOrigins.length === 0) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(
  req: IncomingMessage,
  res: ServerResponse,
  status: number,
  body: unknown,
) {
  writeCors(req, res);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const lastGyroAt = new Map<string, number>();

const httpServer = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS") {
    writeCors(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    json(req, res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/rooms") {
    const room = getOrCreateRoom();
    json(req, res, 201, { code: room.code });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/rooms/")) {
    const code = url.pathname.slice("/rooms/".length);
    const room = getRoom(code);
    if (!room) {
      json(req, res, 404, { error: "Room not found" });
      return;
    }
    json(req, res, 200, { code: room.code, players: listPlayers(room) });
    return;
  }

  json(req, res, 404, { error: "Not found" });
});

const io = new Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>(
  httpServer,
  {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin not allowed"));
      },
    },
  },
);

io.on("connection", (socket) => {
  socket.on("joinRoom", (payload, ack) => {
    const code = payload.code?.toUpperCase().trim();
    if (!code) {
      ack?.({ ok: false, error: "Missing room code" });
      return;
    }

    const room =
      payload.role === "host" ? getOrCreateRoom(code) : getRoom(code);
    if (!room) {
      ack?.({ ok: false, error: "Room not found. Host a party first." });
      return;
    }

    if (socket.data.roomCode) {
      socket.leave(socket.data.roomCode);
      removePlayer(socket.data.roomCode, socket.id);
    }

    const player = addPlayer(room, socket.id, payload.role, payload.name);
    socket.data.roomCode = room.code;
    socket.data.playerId = player.id;
    socket.data.role = player.role;
    socket.join(room.code);

    const players = listPlayers(room);
    for (const member of players) {
      io.to(member.id).emit("roomState", {
        code: room.code,
        players,
        selfId: member.id,
      });
    }
    ack?.({ ok: true, selfId: player.id });
  });

  socket.on("gyro", (sample) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode || socket.data.role !== "controller") return;
    const now = Date.now();
    const previous = lastGyroAt.get(socket.id) ?? 0;
    if (now - previous < GYRO_MIN_INTERVAL_MS) return;
    lastGyroAt.set(socket.id, now);
    socket.to(roomCode).emit("gyroState", {
      playerId: socket.id,
      alpha: sample.alpha,
      beta: sample.beta,
      gamma: sample.gamma,
      timestamp: sample.timestamp || now,
    });
  });

  socket.on("calibrate", (pose) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode || socket.data.role !== "controller") return;
    socket.to(roomCode).emit("calibrated", {
      playerId: socket.id,
      pose,
    });
  });

  socket.on("disconnect", () => {
    lastGyroAt.delete(socket.id);
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    removePlayer(roomCode, socket.id);
    const room = getRoom(roomCode);
    if (!room) return;
    const players = listPlayers(room);
    for (const member of players) {
      io.to(member.id).emit("roomState", {
        code: room.code,
        players,
        selfId: member.id,
      });
    }
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`phoneparty realtime listening on :${PORT}`);
});
