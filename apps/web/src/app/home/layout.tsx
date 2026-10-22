"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, type User } from "@/lib/api";
import { AppSidebar, SIDEBAR_THEME } from "@/components/layout/sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { UserProvider } from "@/contexts/UserContext";
import {
  PageTitleProvider,
  usePageTitleContext,
} from "@/contexts/PageTitleContext";

function getRouteTitle(pathname: string): string | null {
  if (pathname.startsWith("/home/executions")) return "Executions";
  if (pathname.startsWith("/home/credentials")) return "Credentials";
  if (pathname.startsWith("/home/account")) return "Account";
  if (pathname.startsWith("/home/workflows")) return "Workflows";
  return null;
}

function HomeShell({
  user,
  onSignOut,
  children,
}: {
  user: User;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { title: pageTitle } = usePageTitleContext();
  const isDashboard = pathname === "/home";
  const currentTitle =
    pageTitle ?? getRouteTitle(pathname) ?? (isDashboard ? "Dashboard" : "Loading…");

  return (
    <SidebarProvider
      defaultOpen
      style={SIDEBAR_THEME}
      className="min-h-svh text-[var(--surface-text)]"
    >
      <AppSidebar user={user} onSignOut={onSignOut} />

      <SidebarInset className="overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4 md:px-6">
          <SidebarTrigger className="text-[var(--nav-text)] hover:bg-white/10 hover:text-[var(--surface-text)] md:hidden" />
          <h1 className="flex min-w-0 items-center gap-2 pl-4 font-display font-semibold tracking-tight text-[#87867c]">
            {isDashboard ? (
              currentTitle
            ) : (
              <>
                <Link
                  href="/home"
                  className="transition-colors hover:text-white"
                >
                  Dashboard
                </Link>
                <span aria-hidden="true" className="text-[#555550]">
                  /
                </span>
                <span className="truncate text-white">{currentTitle}</span>
              </>
            )}
          </h1>
        </header>

        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function HomeLayout({ children }: { children: ReactNode }) {
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
      <PageTitleProvider>
        <HomeShell user={user} onSignOut={handleSignOut}>
          {children}
        </HomeShell>
      </PageTitleProvider>
    </UserProvider>
  );
}
