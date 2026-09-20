import {
  DEFAULT_GAME_ID,
  PLAYER_COLORS,
  ROOM_ALPHABET,
  ROOM_CODE_LENGTH,
  normalizeGameId,
  type Player,
  type Role,
} from "./protocol.ts";

export type Room = {
  code: string;
  gameId: string;
  players: Map<string, Player>;
  createdAt: number;
};

const rooms = new Map<string, Room>();

function randomCode() {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  }
  return code;
}

export function createRoom(preferred?: string, gameId = DEFAULT_GAME_ID) {
  const requested = preferred?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
  let code =
    requested.length === ROOM_CODE_LENGTH && !rooms.has(requested)
      ? requested
      : randomCode();
  while (rooms.has(code)) {
    code = randomCode();
  }
  const room: Room = {
    code,
    gameId: normalizeGameId(gameId),
    players: new Map(),
    createdAt: Date.now(),
  };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string) {
  return rooms.get(code.toUpperCase()) ?? null;
}

export function getOrCreateRoom(code?: string, gameId = DEFAULT_GAME_ID) {
  if (code) {
    const existing = getRoom(code);
    if (existing) return existing;
    if (code.length === ROOM_CODE_LENGTH) return createRoom(code, gameId);
  }
  return createRoom(undefined, gameId);
}

export function setRoomGame(room: Room, gameId: string) {
  room.gameId = normalizeGameId(gameId);
  return room.gameId;
}

export function addPlayer(room: Room, id: string, role: Role, name?: string) {
  const usedColors = new Set(
    [...room.players.values()]
      .filter((player) => player.role === "controller")
      .map((player) => player.color),
  );
  const color =
    role === "host"
      ? "#111111"
      : (PLAYER_COLORS.find((entry) => !usedColors.has(entry)) ??
        PLAYER_COLORS[usedColors.size % PLAYER_COLORS.length]);
  const player: Player = {
    id,
    role,
    name:
      name?.trim() ||
      (role === "host"
        ? "TV"
        : `Player ${[...room.players.values()].filter((p) => p.role === "controller").length + 1}`),
    color,
    connectedAt: Date.now(),
  };
  room.players.set(id, player);
  return player;
}

export function removePlayer(roomCode: string, playerId: string) {
  const room = getRoom(roomCode);
  if (!room) return;
  room.players.delete(playerId);
  if (room.players.size === 0) {
    rooms.delete(room.code);
  }
}

export function listPlayers(room: Room) {
  return [...room.players.values()];
}

export function listRoomCodes() {
  return [...rooms.keys()];
}
