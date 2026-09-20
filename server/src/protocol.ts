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
  timestamp: number;
};

export type CalibratedPose = {
  alpha: number;
  beta: number;
  gamma: number;
};

export const PLAYER_COLORS = [
  "#c4f542",
  "#ffb020",
  "#5ee0ff",
  "#ff6b8a",
  "#c084fc",
] as const;

export const SOCKET_EVENTS = {
  joinRoom: "joinRoom",
  gyro: "gyro",
  calibrate: "calibrate",
  roomState: "roomState",
  gyroState: "gyroState",
  calibrated: "calibrated",
  error: "error",
} as const;

export interface ClientToServerEvents {
  joinRoom: (
    payload: { code: string; role: Role; name?: string },
    ack?: (res: { ok: boolean; error?: string; selfId?: string }) => void,
  ) => void;
  gyro: (sample: GyroSample) => void;
  calibrate: (pose: CalibratedPose) => void;
}

export interface ServerToClientEvents {
  roomState: (payload: {
    code: string;
    players: Player[];
    selfId: string;
  }) => void;
  gyroState: (payload: { playerId: string } & GyroSample) => void;
  calibrated: (payload: { playerId: string; pose: CalibratedPose }) => void;
  error: (payload: { message: string }) => void;
}

export interface SocketData {
  roomCode?: string;
  playerId?: string;
  role?: Role;
}
