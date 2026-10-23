"use client";

import { createContext, useContext } from "react";

export const EdgeDeleteContext = createContext<
  ((edgeId: string) => void) | null
>(null);

export function useEdgeDelete() {
  return useContext(EdgeDeleteContext);
}
