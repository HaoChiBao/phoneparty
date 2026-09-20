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
  // Host may emit gameAction snapshots so phones can follow turn state.
  sendAction?: (type: string, data?: unknown) => void;
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
  calib: CalibratedPose | null;
  onCalibrate: () => void;
  // True while the shared recorder is capturing a clip. Pads must not fire a
  // scored action from the same motion.
  capturingMotion?: boolean;
};

export type MotionLabel = {
  id: string;
  title: string;
};

export type GameDefinition = {
  id: string;
  title: string;
  blurb: string;
  Scene: ComponentType<GameSceneProps>;
  PadExtra?: ComponentType<GamePadProps>;
  // Games that do not aim at the TV can drop the shared aim pad and its copy.
  hideAimPad?: boolean;
  // Keep the shared Calibrate button when the aim pad is hidden.
  showCalibrate?: boolean;
  // Gesture names for the shared motion recorder ("bear hit", "bear pong flick").
  motionLabels?: MotionLabel[];
  // Phone how-to copy. Shown on the controller when the game opens.
  howToPlay?: string;
  // Hidden under the Advanced picker on the lobby and TV.
  advanced?: boolean;
};

export function motionLabelsFor(game: GameDefinition): MotionLabel[] {
  if (game.motionLabels?.length) return game.motionLabels;
  return [{ id: "move", title: `${game.title} move` }];
}
