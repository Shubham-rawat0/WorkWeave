"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GOOGLE_AUTH_URL, type User, api } from "@/lib/api";

type Status = "loading" | "guest" | "authed";

export default function HomePage() {
    const [status, setStatus] = useState<Status>("loading");
    const [user, setUser] = useState<User | null>(null);

    const loadSession = useCallback(async () => {
        try {
            const data = await api.me();
            setUser(data.user);
            setStatus("authed");
        } catch {
            setUser(null);
            setStatus("guest");
        }
    }, []);

    useEffect(() => {
        void loadSession();
    }, [loadSession]);

    async function handleSignout() {
        try {
            await api.signout();
        } finally {
            setUser(null);
            setStatus("guest");
        }
    }

    if (status === "loading") {
        return (
            <main className="container">
                <p className="status">Loading session…</p>
            </main>
        );
    }

    if (status === "guest") {
        return (
            <main className="container">
                <div className="card">
                    <h1>Auth test</h1>
                    <p className="subtitle">
                        You are not signed in. Try one of the flows below.
                    </p>

                    <a className="btn btn-google" href={GOOGLE_AUTH_URL}>
                        Continue with Google
                    </a>

                    <div className="divider">or</div>

                    <div className="link-row">
                        <Link className="btn btn-primary" href="/login">
                            Sign in
                        </Link>
                        <Link className="btn btn-secondary" href="/register">
                            Register
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="container">
            <div className="card">
                <div className="profile">
                    {user?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            className="avatar"
                            src={user.image}
                            alt={user.name}
                            referrerPolicy="no-referrer"
                        />
                    ) : (
                        <div className="avatar-fallback">
                            {user?.name.charAt(0) ?? "?"}
                        </div>
                    )}
                    <div>
                        <p className="profile-name">{user?.name}</p>
                        <p className="profile-email">{user?.email}</p>
                        <span className="badge">{user?.provider}</span>
                    </div>
                </div>

                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleSignout}
                >
                    Sign out
                </button>
            </div>
        </main>
    );
}
