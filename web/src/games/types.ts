import type { ComponentType } from "react";
import type { CalibratedPose, GameActionState, GyroSample, Player } from "@/lib/protocol";

export type GameSceneProps = {
  controllers: Player[];
  gyroByPlayer: Record<string, GyroSample>;
  calibByPlayer: Record<string, CalibratedPose>;
  actionsByPlayer: Record<string, GameActionState>;
};

export type GamePadProps = {
  sendAction: (type: string, data?: unknown) => void;
  lastAction?: GameActionState;
};

export type GameDefinition = {
  id: string;
  title: string;
  blurb: string;
  Scene: ComponentType<GameSceneProps>;
  PadExtra?: ComponentType<GamePadProps>;
};
