import type { GameDefinition } from "@/games/types";
import { SandboxScene } from "./Scene";

export const sandboxGame: GameDefinition = {
  id: "sandbox",
  title: "Sandbox",
  blurb: "Empty floor. Copy this folder to start a game.",
  Scene: SandboxScene,
};
