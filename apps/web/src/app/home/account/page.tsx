"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api, type SessionInfo } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CARD =
  "rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6";
const INPUT =
  "w-full rounded-lg border border-[#333333] bg-[#151515] px-3.5 py-2.5 text-sm text-white placeholder-[#6b6b68] outline-none transition-colors focus:border-[#F04D26]/70 focus:ring-1 focus:ring-[#F04D26]/40 disabled:opacity-60";
const PRIMARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F04D26] px-4 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_18px_-8px_rgba(240,77,38,0.9)] transition-colors hover:bg-[#F04D26]/90 disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#333333] bg-[#1d1d1d] px-4 text-sm font-medium text-[#e8e6e1] transition-colors hover:bg-[#242424] disabled:cursor-not-allowed disabled:opacity-60";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={CARD}>
      <h2 className="font-display text-xl tracking-tight text-white">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm text-[#87867c]">{description}</p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[13px] font-medium text-[#c9c9c5]">
        {label}
      </span>
      <input className={INPUT} {...props} />
    </label>
  );
}

function Notice({
  kind,
  children,
}: {
  kind: "error" | "success";
  children: ReactNode;
}) {
  const tone =
    kind === "error"
      ? "border-red-500/30 bg-red-500/10 text-red-400"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  return (
    <p className={`rounded-lg border px-3 py-2 text-sm ${tone}`}>{children}</p>
  );
}

function avatarInitial(name: string) {
  return (name.trim().charAt(0) || "U").toUpperCase();
}

function describeDevice(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  const browser = /edg/i.test(userAgent)
    ? "Edge"
    : /chrome/i.test(userAgent)
      ? "Chrome"
      : /firefox/i.test(userAgent)
        ? "Firefox"
        : /safari/i.test(userAgent)
          ? "Safari"
          : "Browser";
  const os = /windows/i.test(userAgent)
    ? "Windows"
    : /mac os/i.test(userAgent)
      ? "macOS"
      : /android/i.test(userAgent)
        ? "Android"
        : /iphone|ipad|ios/i.test(userAgent)
          ? "iOS"
          : /linux/i.test(userAgent)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function isExpired(session: SessionInfo) {
  const expires = new Date(session.expiresAt).getTime();
  return Number.isFinite(expires) && expires <= Date.now();
}

function ProfileSection() {
  const { user, refresh } = useUser();
  const [name, setName] = useState(user.name);
  const [image, setImage] = useState(user.image ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.updateProfile({ name, image });
      await refresh();
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  }

  const preview = image.trim();

  return (
    <Section title="Profile" description="Update your display name and avatar.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-4">
          {preview ? (
            <img
              src={preview}
              alt={name}
              className="size-14 rounded-full object-cover ring-1 ring-white/10"
            />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full bg-[#F04D26]/15 font-serif text-2xl font-medium text-[#F04D26] ring-1 ring-inset ring-[#F04D26]/30">
              {avatarInitial(name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {user.email}
            </p>
            <span className="mt-1 inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#a89fc0]">
              {user.provider}
            </span>
          </div>
        </div>

        <Field
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          required
        />
        <Field
          label="Avatar image URL"
          value={image}
          onChange={(event) => setImage(event.target.value)}
          placeholder="https://example.com/avatar.png"
          inputMode="url"
        />

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={PRIMARY} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save profile"}
          </button>
          {(name !== user.name || image !== (user.image ?? "")) && (
            <button
              type="button"
              className={SECONDARY}
              onClick={() => {
                setName(user.name);
                setImage(user.image ?? "");
                setError(null);
                setSuccess(null);
              }}
            >
              Reset
            </button>
          )}
        </div>

        {error ? <Notice kind="error">{error}</Notice> : null}
        {success ? <Notice kind="success">{success}</Notice> : null}
      </form>
    </Section>
  );
}

function ChangePasswordDialog({
  open,
  onOpenChange,
  onSessionsInvalidated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionsInvalidated: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [logoutOtherDevices, setLogoutOtherDevices] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setLogoutOtherDevices(false);
    setError(null);
    setSuccess(null);
    setIsSaving(false);
  }

  function handleOpenChange(next: boolean) {
    if (isSaving) return;
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setIsSaving(true);
    try {
      const { message, revokedSessions } = await api.changePassword({
        currentPassword,
        newPassword,
        logoutOtherDevices,
      });
      setSuccess(
        logoutOtherDevices && revokedSessions > 0
          ? `${message} (${revokedSessions} session${revokedSessions === 1 ? "" : "s"} revoked)`
          : message,
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLogoutOtherDevices(false);
      if (revokedSessions > 0) onSessionsInvalidated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Choose a strong password you don&apos;t use anywhere else.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="New password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              required
            />
            <Field
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#333333] bg-[#151515] p-3.5">
            <input
              type="checkbox"
              checked={logoutOtherDevices}
              onChange={(event) => setLogoutOtherDevices(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[#F04D26]"
            />
            <span className="text-sm text-[#c9c9c5]">
              Log out of all other devices
              <span className="mt-0.5 block text-xs text-[#87867c]">
                Keep only this session active after the password change.
              </span>
            </span>
          </label>

          {error ? <Notice kind="error">{error}</Notice> : null}
          {success ? <Notice kind="success">{success}</Notice> : null}

          <DialogFooter>
            <DialogClose
              render={
                <button
                  type="button"
                  className={SECONDARY}
                  disabled={isSaving}
                />
              }
            >
              Cancel
            </DialogClose>
            <button type="submit" className={PRIMARY} disabled={isSaving}>
              {isSaving ? "Updating…" : "Update password"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordSection({
  onSessionsInvalidated,
}: {
  onSessionsInvalidated: () => void;
}) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);

  if (user.provider !== "credentials") {
    return (
      <Section
        title="Password"
        description="Password management is unavailable for social sign-in accounts."
      >
        <p className="text-sm text-[#87867c]">
          You signed in with {user.provider}. Manage your password with that
          provider.
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="Password"
      description="Change the password used to sign in to your account."
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-[#87867c]">
          We recommend a unique password you don&apos;t use anywhere else.
        </p>
        <button
          type="button"
          className={PRIMARY}
          onClick={() => setOpen(true)}
        >
          Change password
        </button>
      </div>
      <ChangePasswordDialog
        open={open}
        onOpenChange={setOpen}
        onSessionsInvalidated={onSessionsInvalidated}
      />
    </Section>
  );
}

function SessionsSection({ refreshSignal }: { refreshSignal: number }) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { sessions } = await api.sessions();
      setSessions(sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshSignal]);

  async function revoke(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    setSuccess(null);
    try {
      await api.revokeSession(id);
      setSessions((prev) => prev.filter((session) => session.id !== id));
      setSuccess("Session revoked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke session.");
    } finally {
      setBusyId(null);
    }
  }

  async function revokeOthers() {
    if (isRevokingAll) return;
    setIsRevokingAll(true);
    setError(null);
    setSuccess(null);
    try {
      const { revokedSessions } = await api.revokeOtherSessions();
      setSessions((prev) => prev.filter((session) => session.current));
      setSuccess(
        revokedSessions > 0
          ? `Signed out of ${revokedSessions} other session${revokedSessions === 1 ? "" : "s"}.`
          : "No other active sessions were found.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to revoke sessions.",
      );
    } finally {
      setIsRevokingAll(false);
    }
  }

  const others = sessions.filter(
    (session) => !session.current && !isExpired(session),
  ).length;

  return (
    <Section
      title="Active sessions"
      description="Review devices signed into your account and revoke access."
    >
      {error ? <Notice kind="error">{error}</Notice> : null}
      {success ? (
        <div className="mb-4">
          <Notice kind="success">{success}</Notice>
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-[#87867c]">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-[#87867c]">No active sessions found.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => {
            const expired = isExpired(session);
            return (
              <li
                key={session.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#333333] bg-[#151515] px-4 py-3 ${
                  expired ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#e8e6e1]">
                    {describeDevice(session.userAgent)}
                    {session.current ? (
                      <span className="ml-2 rounded-full border border-[#F04D26]/40 bg-[#F04D26]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#F04D26]">
                        This device
                      </span>
                    ) : null}
                    {expired ? (
                      <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#87867c]">
                        Expired
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#87867c]">
                    {session.ipAddress ?? "Unknown IP"} · Signed in{" "}
                    {formatDate(session.createdAt)}
                  </p>
                </div>
                {session.current ? (
                  <span className="text-xs text-[#6b6b68]">Active now</span>
                ) : expired ? (
                  <span className="text-xs text-[#6b6b68]">Ended</span>
                ) : (
                  <button
                    type="button"
                    className={SECONDARY}
                    onClick={() => revoke(session.id)}
                    disabled={busyId === session.id}
                  >
                    {busyId === session.id ? "Revoking…" : "Revoke"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {others > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            className={SECONDARY}
            onClick={revokeOthers}
            disabled={isRevokingAll}
          >
            {isRevokingAll ? "Signing out…" : "Log out all other devices"}
          </button>
        </div>
      ) : null}
    </Section>
  );
}

export default function AccountPage() {
  const [sessionsRefresh, setSessionsRefresh] = useState(0);

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto w-full max-w-[720px] space-y-6">
        <div>
          <h1 className="font-display text-2xl tracking-tight text-white">
            Account
          </h1>
          <p className="mt-1 text-sm text-[#87867c]">
            Manage your profile, password and active sessions.
          </p>
        </div>
        <ProfileSection />
        <PasswordSection
          onSessionsInvalidated={() => setSessionsRefresh((n) => n + 1)}
        />
        <SessionsSection refreshSignal={sessionsRefresh} />
      </div>
    </div>
  );
}
