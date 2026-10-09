"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GOOGLE_AUTH_URL, api } from "@/lib/api";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await api.signin({ email, password });
            router.push("/");
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Sign in failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="container">
            <div className="card">
                <h1>Welcome back</h1>
                <p className="subtitle">Sign in to your account</p>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </div>

                    <div className="field">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(event) =>
                                setPassword(event.target.value)
                            }
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                    >
                        {loading ? "Signing in…" : "Sign in"}
                    </button>
                </form>

                <div className="divider">or</div>

                <a className="btn btn-google" href={GOOGLE_AUTH_URL}>
                    Continue with Google
                </a>

                <p className="footer-text">
                    Don&apos;t have an account?{" "}
                    <Link href="/register">Create one</Link>
                </p>
            </div>
        </main>
    );
}
