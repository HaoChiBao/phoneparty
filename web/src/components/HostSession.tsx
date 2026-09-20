"use client";

import { useEffect, useState } from "react";
import { HostHud } from "@/components/HostHud";
import { LoadingScreen } from "@/components/LoadingScreen";
import { getGame, hostAssetsFor } from "@/games/catalog";
import { CanvasReadyGate } from "@/games/shared/canvasReady";
import { preloadAssets } from "@/lib/preloadAssets";
import { usePartySocket } from "@/lib/usePartySocket";

export function HostSession({
  code,
  initialGameId,
}: {
  code: string;
  initialGameId?: string;
}) {
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
  } = usePartySocket(code, "host", undefined, initialGameId);
  const [joinUrl, setJoinUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [assetsReady, setAssetsReady] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/c/${code}`);
  }, [code]);

  const controllers = players.filter((player) => player.role === "controller");
  const game = getGame(gameId);
  const Scene = game.Scene;

  useEffect(() => {
    let cancelled = false;
    setAssetsReady(false);
    void preloadAssets(hostAssetsFor(game), (value) => {
      if (!cancelled) setProgress(Math.min(90, Math.round(value * 0.9)));
    }).then(() => {
      if (!cancelled) setAssetsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [game]);

  useEffect(() => {
    if (!booting) return;
    if (!assetsReady || !canvasReady) return;
    setProgress(100);
    const timer = window.setTimeout(() => setBooting(false), 180);
    return () => window.clearTimeout(timer);
  }, [assetsReady, canvasReady, booting]);

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 15000);
    return () => window.clearTimeout(timer);
  }, []);

  const showScene = !booting || assetsReady;

  return (
    <div className="relative h-dvh overflow-hidden bg-[#7eb8e6]">
      {showScene ? (
        <CanvasReadyGate onReady={() => setCanvasReady(true)}>
          <Scene
            controllers={controllers}
            gyroByPlayer={gyroByPlayer}
            calibByPlayer={calibByPlayer}
            actionsByPlayer={actionsByPlayer}
            sendAction={sendGameAction}
          />
        </CanvasReadyGate>
      ) : null}
      {booting ? null : (
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
      )}
      {booting ? <LoadingScreen progress={progress} /> : null}
    </div>
  );
}
