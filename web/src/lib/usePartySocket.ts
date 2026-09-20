"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { connectRealtime } from "./realtime";
import type {
  CalibratedPose,
  ClientToServerEvents,
  GameActionState,
  GyroSample,
  Player,
  Role,
  ServerToClientEvents,
} from "./protocol";
import { DEFAULT_GAME_ID } from "./protocol";

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
  const [gameId, setGameId] = useState(DEFAULT_GAME_ID);
  const [actionsByPlayer, setActionsByPlayer] = useState<
    Record<string, GameActionState>
  >({});
  const [kicked, setKicked] = useState(false);
  const skipJoin = useRef(false);

  useEffect(() => {
    const socket = connectRealtime();
    socketRef.current = socket;

    const join = () => {
      if (skipJoin.current) return;
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
          if (res.gameId) setGameId(res.gameId);
          setKicked(false);
          setError(null);
          setConnected(true);
        },
      );
    };

    socket.on("connect", join);
    socket.on("roomState", (payload) => {
      const ids = new Set(payload.players.map((player) => player.id));
      setPlayers(payload.players);
      setSelfId(payload.selfId);
      setGameId(payload.gameId);
      setConnected(true);
      setGyroByPlayer((current) => {
        const next: Record<string, GyroSample> = {};
        for (const id of ids) {
          if (current[id]) next[id] = current[id];
        }
        return next;
      });
      setCalibByPlayer((current) => {
        const next: Record<string, CalibratedPose> = {};
        for (const id of ids) {
          if (current[id]) next[id] = current[id];
        }
        return next;
      });
      setActionsByPlayer((current) => {
        const next: Record<string, GameActionState> = {};
        for (const id of ids) {
          if (current[id]) next[id] = current[id];
        }
        return next;
      });
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
    socket.on("gameActionState", (payload) => {
      setActionsByPlayer((current) => ({
        ...current,
        [payload.playerId]: payload,
      }));
    });
    socket.on("kicked", () => {
      skipJoin.current = true;
      setKicked(true);
      setConnected(false);
      setPlayers([]);
      setError(null);
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

  function selectGame(nextGameId: string) {
    socketRef.current?.emit("selectGame", { gameId: nextGameId });
  }

  function sendGameAction(type: string, data?: unknown) {
    socketRef.current?.emit("gameAction", { type, data });
  }

  function kickPlayer(playerId: string) {
    socketRef.current?.emit("kickPlayer", { playerId });
  }

  function rejoin() {
    skipJoin.current = false;
    setKicked(false);
    setError(null);
    const socket = socketRef.current;
    if (!socket) return;
    if (!socket.connected) {
      socket.connect();
      return;
    }
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
        if (res.gameId) setGameId(res.gameId);
        setKicked(false);
        setError(null);
        setConnected(true);
      },
    );
  }

  return {
    socketRef,
    players,
    selfId,
    error,
    connected,
    kicked,
    gyroByPlayer,
    calibByPlayer,
    gameId,
    actionsByPlayer,
    selectGame,
    sendGameAction,
    kickPlayer,
    rejoin,
  };
}
