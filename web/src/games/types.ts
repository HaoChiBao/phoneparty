import type { ComponentType } from "react";
import type {
  CalibratedPose,
  GameActionState,
  GyroSample,
  Player,
} from "@/lib/protocol";

export type GameSceneProps = {
  controllers: Player[];
  gyroByPlayer: Record<string, GyroSample>;
  calibByPlayer: Record<string, CalibratedPose>;
  actionsByPlayer: Record<string, GameActionState>;
};

export type GamePadProps = {
  sendAction: (type: string, data?: unknown) => void;
  lastAction?: GameActionState;
  // The whole room's action stream, so a pad can follow turn order without a
  // new socket event. gameActionState is broadcast to every member of the room.
  actionsByPlayer: Record<string, GameActionState>;
  players: Player[];
  selfId: string | null;
  motionReady: boolean;
  sample: GyroSample | null;
};

export type GameDefinition = {
  id: string;
  title: string;
  blurb: string;
  Scene: ComponentType<GameSceneProps>;
  PadExtra?: ComponentType<GamePadProps>;
  // Games that do not aim at the TV can drop the shared aim pad and its copy.
  hideAimPad?: boolean;
};
