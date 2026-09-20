import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./protocol";

export function getRealtimeHttpUrl() {
  const env = process.env.NEXT_PUBLIC_REALTIME_URL?.replace(/\/$/, "");
  if (typeof window === "undefined") {
    return env ?? "http://localhost:4000";
  }
  const { protocol, hostname } = window.location;
  if (env && !env.includes("localhost") && !env.includes("127.0.0.1")) {
    return env;
  }
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return env ?? "http://localhost:4000";
  }
  return `${protocol}//${hostname}:4000`;
}

export function connectRealtime() {
  return io(getRealtimeHttpUrl(), {
    transports: ["websocket", "polling"],
    autoConnect: true,
  }) as Socket<ServerToClientEvents, ClientToServerEvents>;
}

export async function createRoom(gameId?: string) {
  const response = await fetch(`${getRealtimeHttpUrl()}/rooms`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(gameId ? { gameId } : {}),
  });
  if (!response.ok) {
    throw new Error("Could not create a room");
  }
  return (await response.json()) as { code: string; gameId: string };
}
