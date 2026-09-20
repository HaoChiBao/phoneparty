export const ROOM_CODE_LENGTH = 4;
export const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type Role = "host" | "controller";

export type Player = {
  id: string;
  role: Role;
  name: string;
  color: string;
  connectedAt: number;
};

export type GyroSample = {
  alpha: number;
  beta: number;
  gamma: number;
  x: number;
  y: number;
  z: number;
  timestamp: number;
};

export type CalibratedPose = {
  alpha: number;
  beta: number;
  gamma: number;
  x: number;
  y: number;
  z: number;
};

export const PLAYER_COLORS = [
  "#0057FF",
  "#111111",
  "#4C8DFF",
  "#0039B3",
  "#7AA6FF",
] as const;

export const DEFAULT_GAME_ID = "hammer";

export type GameId = string;

export type GameAction = {
  type: string;
  data?: unknown;
};

export type GameActionState = {
  playerId: string;
  type: string;
  data?: unknown;
  timestamp: number;
};

export function normalizeGameId(
  value: unknown,
  fallback = DEFAULT_GAME_ID,
): string {
  if (typeof value !== "string") return fallback;
  const id = value.toLowerCase().trim();
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(id)) return fallback;
  return id;
}

export const SOCKET_EVENTS = {
  joinRoom: "joinRoom",
  gyro: "gyro",
  calibrate: "calibrate",
  selectGame: "selectGame",
  gameAction: "gameAction",
  kickPlayer: "kickPlayer",
  roomState: "roomState",
  gyroState: "gyroState",
  calibrated: "calibrated",
  gameActionState: "gameActionState",
  kicked: "kicked",
  error: "error",
} as const;

export interface ClientToServerEvents {
  joinRoom: (
    payload: { code: string; role: Role; name?: string },
    ack?: (res: {
      ok: boolean;
      error?: string;
      selfId?: string;
      gameId?: string;
    }) => void,
  ) => void;
  gyro: (sample: GyroSample) => void;
  calibrate: (pose: CalibratedPose) => void;
  selectGame: (
    payload: { gameId: string },
    ack?: (res: { ok: boolean; error?: string; gameId?: string }) => void,
  ) => void;
  gameAction: (payload: GameAction) => void;
  kickPlayer: (
    payload: { playerId: string },
    ack?: (res: { ok: boolean; error?: string }) => void,
  ) => void;
}

export interface ServerToClientEvents {
  roomState: (payload: {
    code: string;
    players: Player[];
    selfId: string;
    gameId: string;
  }) => void;
  gyroState: (payload: { playerId: string } & GyroSample) => void;
  calibrated: (payload: { playerId: string; pose: CalibratedPose }) => void;
  gameActionState: (payload: GameActionState) => void;
  kicked: (payload: { message: string }) => void;
  error: (payload: { message: string }) => void;
}

export interface SocketData {
  roomCode?: string;
  playerId?: string;
  role?: Role;
}
