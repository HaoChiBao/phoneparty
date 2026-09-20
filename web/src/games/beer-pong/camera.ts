import type { TeamId } from "./layout";
import type { Phase } from "./rules";

export type CameraPose = {
  position: [number, number, number];
  lookAt: [number, number, number];
};

const OVERVIEW: CameraPose = {
  position: [0, 2.45, 1.55],
  lookAt: [0, 0.76, 0],
};

const TEAM_A: CameraPose = {
  position: [-1.68, 1.62, 0],
  lookAt: [0.52, 0.86, 0],
};

const TEAM_B: CameraPose = {
  position: [1.68, 1.62, 0],
  lookAt: [-0.52, 0.86, 0],
};

export function cameraPose(team: TeamId | null, phase: Phase): CameraPose {
  if (!team || phase === "waiting" || phase === "over") return OVERVIEW;
  return team === "a" ? TEAM_A : TEAM_B;
}
