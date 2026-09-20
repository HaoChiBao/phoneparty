import { archeryGame } from "./archery";
import { beerPongGame } from "./beer-pong";
import { fishingGame } from "./fishing";
import { hammerGame } from "./hammer";
import { shakeGame } from "./shake";
import type { GameDefinition } from "./types";

const games: GameDefinition[] = [
  hammerGame,
  shakeGame,
  archeryGame,
  fishingGame,
  beerPongGame,
];

const HIDDEN_FROM_PICKER = new Set(["range", "sandbox"]);

export function listGames() {
  return games.filter((game) => !HIDDEN_FROM_PICKER.has(game.id));
}

export function getGame(id: string | null | undefined): GameDefinition {
  return games.find((game) => game.id === id) ?? hammerGame;
}

export function isKnownGame(id: string) {
  return games.some((game) => game.id === id);
}
