import type { GameDefinition } from "@/games/types";
import { BeerPongPad } from "./Pad";
import { BeerPongScene } from "./Scene";

export const beerPongGame: GameDefinition = {
  id: "beer-pong",
  title: "Beer pong",
  blurb: "Two sides, ten cups. Take turns. Clear the other rack.",
  Scene: BeerPongScene,
  PadExtra: BeerPongPad,
  hideAimPad: true,
  showCalibrate: true,
  motionLabels: [{ id: "flick", title: "beer pong flick" }],
  howToPlay:
    "Scan the QR, enable motion, and calibrate at the TV. When your phone is green, flick toward the cups. Take turns. Clear the other rack.",
};
