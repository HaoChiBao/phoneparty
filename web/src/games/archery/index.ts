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
  howToPlay:
    "Scan the QR and enable motion. Point the back of the phone at the TV, tap Ready, then tilt to aim. Hold still for five seconds and the arrow looses. Three arrows each. Aim into the wind.",
};
