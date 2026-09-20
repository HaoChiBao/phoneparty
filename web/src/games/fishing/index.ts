import type { GameDefinition } from "@/games/types";
import { FishingPad } from "./Pad";
import { FishingScene } from "./Scene";

export const fishingGame: GameDefinition = {
  id: "fishing",
  title: "Salmon",
  blurb: "Hook salmon and mash to reel them in. Bigger fish fight harder. Most points wins.",
  Scene: FishingScene,
  PadExtra: FishingPad,
  hideAimPad: true,
  motionLabels: [{ id: "hook", title: "hook a fish" }],
  howToPlay:
    "Scan the QR and enable motion. Point the camera at the TV to move your hook. Hover over a fish and tap Hook to latch, then mash the screen to reel it in. Bigger fish take more taps. Everyone fishes at once for 30 seconds — most points wins.",
  assets: [
    "/fishing/bckgrndwave.png",
    "/fishing/wavestreak.png",
    "/fishing/fish-small.png",
    "/fishing/fish-medium.png",
    "/fishing/fish-large.png",
    "/fishing/hook.png",
  ],
};
