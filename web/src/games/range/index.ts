import type { GameDefinition } from "@/games/types";
import { RangeScene } from "./Scene";

export const rangeGame: GameDefinition = {
  id: "range",
  title: "Range",
  blurb: "Aim at the rings.",
  Scene: RangeScene,
};
