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
  howToPlay:
    "Scan the QR, tap Enable motion, then Ready. When the phone turns green, swing down and hit the tree. Stronger swings shake more apples. Most apples wins.",
  advanced: true,
  assets: ["/game_bg.mp4"],
};
