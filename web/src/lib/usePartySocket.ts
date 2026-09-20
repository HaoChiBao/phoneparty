"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { connectRealtime } from "./realtime";
import type {
  CalibratedPose,
  ClientToServerEvents,
  GyroSample,
  Player,
  Role,
  ServerToClientEvents,
} from "./protocol";

type PartySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function usePartySocket(code: string, role: Role, name?: string) {
  const socketRef = useRef<PartySocket | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [gyroByPlayer, setGyroByPlayer] = useState<Record<string, GyroSample>>(
    {},
  );
  const [calibByPlayer, setCalibByPlayer] = useState<
    Record<string, CalibratedPose>
  >({});

  useEffect(() => {
    const socket = connectRealtime();
    socketRef.current = socket;

    const join = () => {
      socket.emit(
        "joinRoom",
        { code, role, name },
        (res) => {
          if (!res.ok) {
            setError(res.error ?? "Could not join room");
            setConnected(false);
            return;
          }
          setSelfId(res.selfId ?? socket.id ?? null);
          setError(null);
          setConnected(true);
        },
      );
    };

    socket.on("connect", join);
    socket.on("roomState", (payload) => {
      setPlayers(payload.players);
      setSelfId(payload.selfId);
      setConnected(true);
    });
    socket.on("gyroState", (payload) => {
      setGyroByPlayer((current) => ({
        ...current,
        [payload.playerId]: {
          alpha: payload.alpha,
          beta: payload.beta,
          gamma: payload.gamma,
          x: payload.x ?? 0,
          y: payload.y ?? 0,
          z: payload.z ?? 0,
          timestamp: payload.timestamp,
        },
      }));
    });
    socket.on("calibrated", (payload) => {
      setCalibByPlayer((current) => ({
        ...current,
        [payload.playerId]: payload.pose,
      }));
    });
    socket.on("error", (payload) => {
      setError(payload.message);
    });
    socket.on("disconnect", () => {
      setConnected(false);
    });

    if (socket.connected) join();

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [code, name, role]);

  return {
    socketRef,
    players,
    selfId,
    error,
    connected,
    gyroByPlayer,
    calibByPlayer,
  };
}
