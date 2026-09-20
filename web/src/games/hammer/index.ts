import type { GameDefinition } from "@/games/types";
import { HammerPad } from "./Pad";
import { HammerScene } from "./Scene";

export const hammerGame: GameDefinition = {
  id: "hammer",
  title: "Apples",
  blurb: "You're a bear. Hit the tree. Stronger swings shake more apples out.",
  Scene: HammerScene,
  PadExtra: HammerPad,
  hideAimPad: true,
  motionLabels: [{ id: "hit", title: "bear hit" }],
};
