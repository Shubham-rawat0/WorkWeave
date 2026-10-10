"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  AuthInput,
  AuthLayout,
  Divider,
  ErrorBanner,
  FooterDisclaimer,
  OAuthButton,
  PrimaryButton,
} from "@/components/auth/AuthShell";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    setError(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);

    try {
      await api.signin({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      });
      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid email or password.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to access your workflows"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-[#F04D26] transition-colors hover:text-[#E63D00]"
          >
            Create one
          </Link>
        </>
      }
    >
      <OAuthButton />

      <Divider />

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          inputMode="email"
          required
        />

        <div className="space-y-2">
          <AuthInput
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
          />
        </div>

        <PrimaryButton type="submit" isLoading={isLoading}>
          Continue
        </PrimaryButton>
      </form>

      <FooterDisclaimer />
    </AuthLayout>
  );
}
