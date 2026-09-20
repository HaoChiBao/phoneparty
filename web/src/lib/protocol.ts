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
  "#0057FF",
  "#111111",
  "#4C8DFF",
  "#0039B3",
  "#7AA6FF",
] as const;

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
