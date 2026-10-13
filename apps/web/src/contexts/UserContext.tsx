"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { User } from "@/lib/api";

export interface UserContextValue {
  user: User;
  signOut: () => void;
  isSigningOut: boolean;
  refresh: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within a <UserProvider>");
  }
  return ctx;
}

export function UserProvider({
  children,
  ...value
}: UserContextValue & { children: ReactNode }) {
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export default UserProvider;
