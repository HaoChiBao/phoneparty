import type { GameDefinition } from "@/games/types";
import { HammerPad } from "./Pad";
import { HammerScene } from "./Scene";

export const hammerGame: GameDefinition = {
  id: "hammer",
  title: "Hammer",
  blurb: "Take turns. Swing the phone down like a mallet. Highest wins.",
  Scene: HammerScene,
  PadExtra: HammerPad,
  hideAimPad: true,
};
