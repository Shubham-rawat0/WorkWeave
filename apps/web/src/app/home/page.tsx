"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type User } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api
      .me()
      .then(({ user }) => {
        if (!cancelled) setUser(user);
      })
      .catch(() => {
        if (cancelled) return;
        router.replace("/login");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await api.signout();
    } finally {
      setIsSigningOut(false);
      router.push("/");
      router.refresh();
    }
  }

  if (!user) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-[#151515] px-5 text-white">
        <div className="w-full max-w-[420px] rounded-2xl border border-[#272727] bg-[#1a1a1a] p-8 text-center">
          <p className="text-sm text-[#87867c]">Checking session…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#151515] px-5 py-12 text-white">
      <div className="w-full max-w-[420px] rounded-2xl border border-[#272727] bg-[#1a1a1a] p-8 shadow-[0_2px_24px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-xl border border-[#F04D26]/40 bg-[#F04D26]/10 font-serif text-2xl font-medium text-[#F04D26]">
            {user.name.charAt(0).toUpperCase() || "U"}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {user.name}
            </h1>
            <p className="truncate text-sm text-[#87867c]">{user.email}</p>
            <span className="mt-1 inline-block rounded-full border border-[#333333] bg-[#1d1d1d] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#a89fc0]">
              {user.provider}
            </span>
          </div>
        </div>

        <div className="my-6 h-px bg-[#272727]" />

        <p className="text-sm text-[#87867c]">
          You&apos;re signed in. Your workflows will live here.
        </p>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="mt-6 flex h-11 w-full items-center justify-center rounded-lg border border-[#333333] bg-[#1d1d1d] text-sm font-medium text-[#e8e6e1] transition-colors hover:bg-[#242424] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSigningOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </main>
  );
}
