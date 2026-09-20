import type { GameDefinition } from "@/games/types";
import { ShakePad } from "./Pad";
import { ShakeScene } from "./Scene";

export const shakeGame: GameDefinition = {
  id: "shake",
  title: "Shake",
  blurb:
    "You're a bear. Hold the phone flat and shake the trunk. Most apples in 30 seconds wins.",
  Scene: ShakeScene,
  PadExtra: ShakePad,
  hideAimPad: true,
  motionLabels: [{ id: "shake", title: "bear shake" }],
  howToPlay:
    "Scan the QR and enable motion. Hold the phone flat with the camera facing the ground, grab a trunk, and shake. Thirty seconds, most apples wins.",
};
