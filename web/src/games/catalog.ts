import { archeryGame } from "./archery";
import { beerPongGame } from "./beer-pong";
import { fishingGame } from "./fishing";
import { hammerGame } from "./hammer";
import { shakeGame } from "./shake";
import type { GameDefinition } from "./types";

export const SHARED_HOST_ASSETS = ["/bearlympics.png", "/game-sign.png"];

export function hostAssetsFor(game: GameDefinition) {
  return [...new Set([...SHARED_HOST_ASSETS, ...(game.assets ?? [])])];
}

const games: GameDefinition[] = [
  archeryGame,
  fishingGame,
  beerPongGame,
  hammerGame,
  shakeGame,
];

const HIDDEN_FROM_PICKER = new Set(["range", "sandbox"]);

export function listGames() {
  return games.filter((game) => !HIDDEN_FROM_PICKER.has(game.id));
}

export function listFeaturedGames() {
  return listGames().filter((game) => !game.advanced);
}

export function listAdvancedGames() {
  return listGames().filter((game) => game.advanced);
}

export function getGame(id: string | null | undefined): GameDefinition {
  return games.find((game) => game.id === id) ?? archeryGame;
}

export function isKnownGame(id: string) {
  return games.some((game) => game.id === id);
}
