"use client";

import { createContext, useContext, type ReactNode } from "react";

const CanvasReady = createContext<(() => void) | null>(null);

export function CanvasReadyGate({
  onReady,
  children,
}: {
  onReady: () => void;
  children: ReactNode;
}) {
  return <CanvasReady.Provider value={onReady}>{children}</CanvasReady.Provider>;
}

export function useCanvasReady() {
  return useContext(CanvasReady);
}
