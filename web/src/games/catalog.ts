import { beerPongGame } from "./beer-pong";
import { rangeGame } from "./range";
import { sandboxGame } from "./sandbox";
import type { GameDefinition } from "./types";

const games: GameDefinition[] = [rangeGame, beerPongGame, sandboxGame];

export function listGames() {
  return games;
}

export function getGame(id: string | null | undefined): GameDefinition {
  return games.find((game) => game.id === id) ?? rangeGame;
}

export function isKnownGame(id: string) {
  return games.some((game) => game.id === id);
}
