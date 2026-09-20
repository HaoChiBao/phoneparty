import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server } from "socket.io";
import {
  normalizeGameId,
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
  setRoomGame,
  type Room,
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
  if (allowedOrigins.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (hostname.endsWith(".vercel.app")) return true;
  } catch {
    return false;
  }
  return false;
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

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

const lastGyroAt = new Map<string, number>();
const lastGameActionAt = new Map<string, number>();
const GAME_ACTION_MIN_INTERVAL_MS = 32;

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
    readJson(req)
      .then((body) => {
        const gameId = normalizeGameId(
          body && typeof body === "object" && "gameId" in body
            ? (body as { gameId?: unknown }).gameId
            : undefined,
        );
        const room = getOrCreateRoom(undefined, gameId);
        json(req, res, 201, { code: room.code, gameId: room.gameId });
      })
      .catch(() => {
        json(req, res, 400, { error: "Invalid JSON" });
      });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/rooms/")) {
    const code = url.pathname.slice("/rooms/".length);
    const room = getRoom(code);
    if (!room) {
      json(req, res, 404, { error: "Room not found" });
      return;
    }
    json(req, res, 200, {
      code: room.code,
      gameId: room.gameId,
      players: listPlayers(room),
    });
    return;
  }

  json(req, res, 404, { error: "Not found" });
});

function emitRoomState(room: Room) {
  const players = listPlayers(room);
  for (const member of players) {
    io.to(member.id).emit("roomState", {
      code: room.code,
      players,
      selfId: member.id,
      gameId: room.gameId,
    });
  }
}

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

    if (payload.role === "controller") {
      const alreadyIn =
        socket.data.roomCode === room.code && socket.data.role === "controller";
      const phones = [...room.players.values()].filter(
        (player) => player.role === "controller" && player.id !== socket.id,
      ).length;
      if (!alreadyIn && phones >= 2) {
        ack?.({ ok: false, error: "Room is full. Two phones max." });
        return;
      }
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

    emitRoomState(room);
    ack?.({ ok: true, selfId: player.id, gameId: room.gameId });
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
      x: sample.x ?? 0,
      y: sample.y ?? 0,
      z: sample.z ?? 0,
      timestamp: sample.timestamp || now,
    });
  });

  socket.on("calibrate", (pose) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode || socket.data.role !== "controller") return;
    io.to(roomCode).emit("calibrated", {
      playerId: socket.id,
      pose,
    });
  });

  socket.on("selectGame", (payload, ack) => {
    const roomCode = socket.data.roomCode;
    const room = roomCode ? getRoom(roomCode) : null;
    if (!room || socket.data.role !== "host") {
      ack?.({ ok: false, error: "Only the host can pick a game" });
      return;
    }
    const gameId = setRoomGame(room, payload.gameId);
    emitRoomState(room);
    ack?.({ ok: true, gameId });
  });

  socket.on("kickPlayer", (payload, ack) => {
    const roomCode = socket.data.roomCode;
    const room = roomCode ? getRoom(roomCode) : null;
    if (!room || socket.data.role !== "host") {
      ack?.({ ok: false, error: "Only the host can kick a phone" });
      return;
    }
    const playerId = payload.playerId;
    const target = room.players.get(playerId);
    if (!target || target.role !== "controller") {
      ack?.({ ok: false, error: "That phone is not in this room" });
      return;
    }

    const targetSocket = io.sockets.sockets.get(playerId);
    targetSocket?.emit("kicked", {
      message: "The TV removed you from the room.",
    });
    targetSocket?.leave(room.code);
    if (targetSocket) {
      targetSocket.data.roomCode = undefined;
      targetSocket.data.playerId = undefined;
      targetSocket.data.role = undefined;
    }
    lastGyroAt.delete(playerId);
    lastGameActionAt.delete(playerId);
    removePlayer(room.code, playerId);
    const next = getRoom(room.code);
    if (next) emitRoomState(next);
    ack?.({ ok: true });
  });

  socket.on("gameAction", (payload) => {
    const roomCode = socket.data.roomCode;
    const role = socket.data.role;
    if (!roomCode || (role !== "controller" && role !== "host")) return;
    const now = Date.now();
    const previous = lastGameActionAt.get(socket.id) ?? 0;
    if (now - previous < GAME_ACTION_MIN_INTERVAL_MS) return;
    lastGameActionAt.set(socket.id, now);
    const type = String(payload?.type ?? "").slice(0, 48);
    if (!type) return;
    io.to(roomCode).emit("gameActionState", {
      playerId: socket.id,
      type,
      data: payload.data,
      timestamp: now,
    });
  });

  socket.on("disconnect", () => {
    lastGyroAt.delete(socket.id);
    lastGameActionAt.delete(socket.id);
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    removePlayer(roomCode, socket.id);
    const room = getRoom(roomCode);
    if (!room) return;
    emitRoomState(room);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`phoneparty realtime listening on :${PORT}`);
});
