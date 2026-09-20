import type { TeamId } from "./layout";
import type { Phase } from "./rules";

export type CameraPose = {
  position: [number, number, number];
  lookAt: [number, number, number];
};

const OVERVIEW: CameraPose = {
  position: [0, 1.95, 3.15],
  lookAt: [0, 0.72, 0],
};

const TEAM_A: CameraPose = {
  position: [-2.7, 1.42, 0.28],
  lookAt: [0.82, 0.86, 0],
};

const TEAM_B: CameraPose = {
  position: [2.7, 1.42, 0.28],
  lookAt: [-0.82, 0.86, 0],
};

export function cameraPose(team: TeamId | null, phase: Phase): CameraPose {
  if (!team || phase === "waiting" || phase === "over") return OVERVIEW;
  return team === "a" ? TEAM_A : TEAM_B;
}
