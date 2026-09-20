import type { GameDefinition } from "@/games/types";
import { FishingPad } from "./Pad";
import { FishingScene } from "./Scene";

export const fishingGame: GameDefinition = {
  id: "fishing",
  title: "Salmon",
  blurb: "You're a bear at the river. Swipe salmon for 30 seconds. Most fish wins.",
  Scene: FishingScene,
  PadExtra: FishingPad,
  hideAimPad: true,
  motionLabels: [{ id: "swipe", title: "bear swipe" }],
  howToPlay:
    "Scan the QR and enable motion. Point the camera at the TV to move your paw. Line up a salmon and jab the phone straight down to swipe. Thirty seconds, most fish wins.",
};
