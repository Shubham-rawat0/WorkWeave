"use client";

import { useState } from "react";
import type { SyntheticEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { AuthInput, AuthLayout, ErrorBanner, PrimaryButton } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleRequest(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = await api.requestPasswordReset({ email });
      setMessage(result.message);
      setCodeSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset code.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReset(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      await api.resetPassword({
        email,
        otp: String(data.get("otp") ?? ""),
        newPassword: String(data.get("newPassword") ?? ""),
      });
      router.push("/login?reset=success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={codeSent ? "Enter the code from your email and choose a new password." : "We’ll email you a one time code to reset your password."}
      footer={<><Link href="/login" className="font-medium text-[#F04D26] hover:text-[#E63D00]">Back to sign in</Link></>}
    >
      {error && <ErrorBanner message={error} />}
      {message && <p className="mb-4 text-sm text-[#c9c9c5]">{message}</p>}
      {!codeSent ? (
        <form onSubmit={handleRequest} className="space-y-4">
          <AuthInput label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <PrimaryButton type="submit" isLoading={isLoading}>Send reset code</PrimaryButton>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-4">
          <AuthInput label="Email" name="email" type="email" value={email} readOnly />
          <AuthInput label="6 digit code" name="otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
          <AuthInput label="New password" name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
          <PrimaryButton type="submit" isLoading={isLoading}>Reset password</PrimaryButton>
        </form>
      )}
    </AuthLayout>
  );
}
