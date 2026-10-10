"use client";
import React from "react";

interface SideLineProps {
  side: "left" | "right";
}

export function SideLine({ side }: SideLineProps) {
  return (
    <div
      aria-hidden="true"
      className={`hidden h-px flex-1 lg:block ${
        side === "left"
          ? "bg-gradient-to-r from-transparent via-[var(--nav-text)]/35 to-[var(--nav-text)]/55"
          : "bg-gradient-to-l from-transparent via-[var(--nav-text)]/35 to-[var(--nav-text)]/55"
      }`}
    />
  );
}
