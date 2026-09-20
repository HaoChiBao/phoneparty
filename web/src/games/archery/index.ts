import type { GameDefinition } from "@/games/types";
import { ArcheryPad } from "./Pad";
import { ArcheryScene } from "./Scene";

export const archeryGame: GameDefinition = {
  id: "archery",
  title: "Archery",
  blurb: "Take turns, one arrow at a time. Aim with the back of the phone. Hold steady to loose.",
  Scene: ArcheryScene,
  PadExtra: ArcheryPad,
  hideAimPad: true,
};
