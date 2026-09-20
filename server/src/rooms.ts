import {
  PLAYER_COLORS,
  ROOM_ALPHABET,
  ROOM_CODE_LENGTH,
  type Player,
  type Role,
} from "./protocol.ts";

export type Room = {
  code: string;
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

export function createRoom(preferred?: string) {
  const requested = preferred?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
  let code =
    requested.length === ROOM_CODE_LENGTH && !rooms.has(requested)
      ? requested
      : randomCode();
  while (rooms.has(code)) {
    code = randomCode();
  }
  const room: Room = { code, players: new Map(), createdAt: Date.now() };
  rooms.set(code, room);
  return room;
}

export function getRoom(code: string) {
  return rooms.get(code.toUpperCase()) ?? null;
}

export function getOrCreateRoom(code?: string) {
  if (code) {
    const existing = getRoom(code);
    if (existing) return existing;
    if (code.length === ROOM_CODE_LENGTH) return createRoom(code);
  }
  return createRoom();
}

export function addPlayer(room: Room, id: string, role: Role, name?: string) {
  const usedColors = new Set(
    [...room.players.values()].map((player) => player.color),
  );
  const color =
    PLAYER_COLORS.find((entry) => !usedColors.has(entry)) ??
    PLAYER_COLORS[room.players.size % PLAYER_COLORS.length];
  const player: Player = {
    id,
    role,
    name:
      name?.trim() ||
      (role === "host" ? "TV" : `Player ${room.players.size + 1}`),
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
