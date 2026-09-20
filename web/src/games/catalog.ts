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

export function listGames() {
  return games;
}

export function getGame(id: string | null | undefined): GameDefinition {
  return games.find((game) => game.id === id) ?? hammerGame;
}

export function isKnownGame(id: string) {
  return games.some((game) => game.id === id);
}
