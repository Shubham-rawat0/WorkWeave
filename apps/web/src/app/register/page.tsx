"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";
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

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    setError(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);

    try {
      await api.signup({ name, email, password });
      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start building powerful workflow automations"
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-[#F04D26] transition-colors hover:text-[#E63D00]"
          >
            Sign in
          </Link>
        </>
      }
    >
      <OAuthButton />

      <Divider />

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput
          label="Full name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Enter your full name"
          maxLength={100}
          required
        />

        <AuthInput
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          inputMode="email"
          required
        />

        <div className="space-y-1.5">
          <AuthInput
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
          <p className="pl-1 text-xs text-[#87867c]">
            Must be at least 8 characters
          </p>
        </div>

        <PrimaryButton type="submit" isLoading={isLoading}>
          Create account
        </PrimaryButton>
      </form>

      <FooterDisclaimer />
    </AuthLayout>
  );
}
