import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import WLogo from "@/components/landing-page/header/w-logo";
import { GOOGLE_AUTH_URL } from "@/lib/api";


interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#151515] px-5 py-12 text-white">
      {/* Restrained top glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(240,77,38,0.07),transparent)]"
      />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <WLogo className="h-9 w-9" />
          <span className="text-lg font-semibold tracking-tight text-white">
            Work
            <span className="font-medium text-[#a89fc0]">Orchestrator</span>
          </span>
        </div>

        <div className="rounded-2xl border border-[#272727] bg-[#1a1a1a] p-6 shadow-[0_2px_24px_rgba(0,0,0,0.4)] sm:p-8">
          <h1 className="font-serif text-2xl tracking-tight text-white">
            {title}
          </h1>
          <p className="mb-6 mt-1.5 text-sm text-[#87867c]">{subtitle}</p>

          {children}
        </div>

        <div className="mt-6 text-center text-sm text-[#87867c]">{footer}</div>
      </div>
    </main>
  );
}

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function AuthInput({ label, id, className, ...props }: AuthInputProps) {
  const inputId = id ?? `auth-${props.name ?? "input"}`;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-[13px] font-medium text-[#c9c9c5]"
      >
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full rounded-lg border border-[#333333] bg-[#151515] px-3.5 py-2.5 text-sm text-white placeholder-[#6b6b68] outline-none transition-colors focus:border-[#F04D26]/70 focus:ring-1 focus:ring-[#F04D26]/40 ${
          className ?? ""
        }`}
        {...props}
      />
    </div>
  );
}

export function OAuthButton() {
  return (
    <a
      href={GOOGLE_AUTH_URL}
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-[#333333] bg-[#1d1d1d] text-sm font-medium text-[#e8e6e1] transition-colors hover:bg-[#242424] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F04D26]"
    >
      <GoogleGlyph />
      Continue with Google
    </a>
  );
}

function GoogleGlyph() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 48 48">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.6 6.1 29.5 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.6 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 40.9 44 36 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

export function Divider() {
  return (
    <div className="my-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-[#333333]" />
      <span className="text-xs text-[#87867c]">or</span>
      <span className="h-px flex-1 bg-[#333333]" />
    </div>
  );
}

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}

export function PrimaryButton({
  isLoading,
  children,
  disabled,
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#F04D26] text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_18px_-8px_rgba(240,77,38,0.9)] transition-colors duration-150 hover:bg-[#F04D26]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoading && (
        <svg
          aria-hidden="true"
          className="size-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="2.5"
          />
          <path
            d="M22 12a10 10 0 0 0-10-10"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      )}
      {children}
    </button>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
    >
      {message}
    </div>
  );
}

export function FooterDisclaimer() {
  return (
    <p className="mt-6 text-center text-xs leading-relaxed text-[#6b6b68]">
      By continuing you agree to the Terms of Service and Privacy Policy.
    </p>
  );
}
