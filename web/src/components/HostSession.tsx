"use client";

import { useEffect, useState } from "react";
import { HowToPlay } from "@/components/HowToPlay";
import { HostHud } from "@/components/HostHud";
import { getGame } from "@/games/catalog";
import { usePartySocket } from "@/lib/usePartySocket";

export function HostSession({ code }: { code: string }) {
  const {
    players,
    connected,
    error,
    gyroByPlayer,
    calibByPlayer,
    gameId,
    actionsByPlayer,
    selectGame,
    sendGameAction,
    kickPlayer,
  } = usePartySocket(code, "host");
  const [joinUrl, setJoinUrl] = useState("");

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/c/${code}`);
  }, [code]);

  const controllers = players.filter((player) => player.role === "controller");
  const game = getGame(gameId);
  const Scene = game.Scene;

  return (
    <div className="relative h-dvh overflow-hidden bg-white">
      <Scene
        controllers={controllers}
        gyroByPlayer={gyroByPlayer}
        calibByPlayer={calibByPlayer}
        actionsByPlayer={actionsByPlayer}
        sendAction={sendGameAction}
      />
      {game.howToPlay ? (
        <HowToPlay key={game.id} title={game.title} body={game.howToPlay} />
      ) : null}
      <HostHud
        code={code}
        joinUrl={joinUrl}
        players={players}
        connected={connected}
        error={error}
        gyroByPlayer={gyroByPlayer}
        gameId={gameId}
        onSelectGame={selectGame}
        onKick={kickPlayer}
      />
    </div>
  );
}
