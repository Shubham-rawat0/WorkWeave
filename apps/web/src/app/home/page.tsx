"use client";

import { useUser } from "@/contexts/UserContext";

export default function HomePage() {
  const { user } = useUser();

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto w-full max-w-[720px] rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-xl border border-[#F04D26]/40 bg-[#F04D26]/10 font-serif text-2xl font-medium text-[#F04D26]">
            {user.name.charAt(0).toUpperCase() || "U"}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-tight">
              {user.name}
            </h2>
            <p className="truncate text-sm text-[#87867c]">{user.email}</p>
            <span className="mt-1 inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#a89fc0]">
              {user.provider}
            </span>
          </div>
        </div>

        <div className="my-6 h-px bg-white/10" />

        <p className="text-sm text-[#87867c]">
          You&apos;re signed in. Your workflows will live here.
        </p>
      </div>
    </div>
  );
}
