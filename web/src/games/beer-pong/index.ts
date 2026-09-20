import type { GameDefinition } from "@/games/types";
import { BeerPongPad } from "./Pad";
import { BeerPongScene } from "./Scene";

export const beerPongGame: GameDefinition = {
  id: "beer-pong",
  title: "Bear pong",
  blurb: "Two sides, ten cups. Take turns. Clear the other rack.",
  Scene: BeerPongScene,
  PadExtra: BeerPongPad,
  hideAimPad: true,
  showCalibrate: true,
  motionLabels: [{ id: "flick", title: "bear pong flick" }],
  howToPlay:
    "Scan the QR, enable motion, and calibrate at the TV. When your phone is green, flick toward the cups. Sink a cup and throw again. A miss passes the turn.",
  assets: [
    "/game_bg.mp4",
    "/beer-pong/bear-throw.png",
    "/beer-pong/bear-throw.webm",
    "/beer-pong/bear-throw.mp4",
  ],
};
