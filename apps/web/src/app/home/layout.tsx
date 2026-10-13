"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, type User } from "@/lib/api";
import { AppSidebar, SIDEBAR_THEME } from "@/components/layout/sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { UserProvider } from "@/contexts/UserContext";

export default function HomeLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const pageTitle =
    pathname === "/home"
      ? "Dashboard"
      : pathname.startsWith("/home/workflows")
        ? "Workflows"
        : pathname.startsWith("/home/executions")
          ? "Executions"
          : pathname.startsWith("/home/credentials")
            ? "Credentials"
            : pathname.startsWith("/home/account")
              ? "Account"
              : "Dashboard";

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

  async function refresh() {
    const { user: nextUser } = await api.me();
    setUser(nextUser);
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
    <UserProvider
      user={user}
      signOut={handleSignOut}
      isSigningOut={isSigningOut}
      refresh={refresh}
    >
      <SidebarProvider
        defaultOpen
        style={SIDEBAR_THEME}
        className="min-h-svh text-[var(--surface-text)]"
      >
        <AppSidebar user={user} onSignOut={handleSignOut} />

        <SidebarInset className="overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4 md:px-6">
            <SidebarTrigger className="text-[var(--nav-text)] hover:bg-white/10 hover:text-[var(--surface-text)] md:hidden" />
            <h1 className="pl-4 font-display font-semibold tracking-tight text-[#87867c]">
              {pageTitle}
            </h1>
          </header>

          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </UserProvider>
  );
}
