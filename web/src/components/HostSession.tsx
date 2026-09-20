"use client";

import { useEffect, useState } from "react";
import { HostHud } from "@/components/HostHud";
import { PartyScene } from "@/components/PartyScene";
import { usePartySocket } from "@/lib/usePartySocket";

export function HostSession({ code }: { code: string }) {
  const { players, connected, error, gyroByPlayer, calibByPlayer } =
    usePartySocket(code, "host");
  const [joinUrl, setJoinUrl] = useState("");

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/c/${code}`);
  }, [code]);

  const controllers = players.filter((player) => player.role === "controller");

  return (
    <div className="relative h-dvh overflow-hidden bg-white">
      <PartyScene
        controllers={controllers}
        gyroByPlayer={gyroByPlayer}
        calibByPlayer={calibByPlayer}
      />
      <HostHud
        code={code}
        joinUrl={joinUrl}
        players={players}
        connected={connected}
        error={error}
        gyroByPlayer={gyroByPlayer}
      />
    </div>
  );
}
