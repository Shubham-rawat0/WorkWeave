"use client";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import Github from "@lobehub/icons/es/Github";
import Notion from "@lobehub/icons/es/Notion";
import { Pencil, Plus, Settings, Trash2 } from "lucide-react";
import { api, type CredentialSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
const EASE_OUT_QUAD = [0.25, 0.46, 0.45, 0.94] as const;
const PLATFORMS = [
  {
    value: "openai",
    label: "OpenAI",
    logo: "/logo/openai.svg",
    accent: "bg-white/10 text-white ring-white/15",
    description: "GPT models for text generation",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    logo: "/logo/anthropic.svg",
    accent: "bg-white/10 text-white ring-white/15",
    description: "Claude models for AI tasks",
  },
  {
    value: "gemini",
    label: "Gemini",
    logo: "/logo/gemini.svg",
    accent: "bg-white/10 text-white ring-white/15",
    description: "Google AI models",
  },
  {
    value: "github",
    label: "GitHub",
    icon: Github,
    accent: "bg-white/10 text-white ring-white/15",
    description: "Repository and issue automation",
  },
  {
    value: "notion",
    label: "Notion",
    icon: Notion,
    accent: "bg-white/10 text-white ring-white/15",
    description: "Notion database page operations",
  },
  {
    value: "slack",
    label: "Slack",
    logo: "/logo/slack.svg",
    accent: "bg-[#E01E5A]/15 text-[#F2668C] ring-[#E01E5A]/25",
    description: "Send messages via webhook",
  },
  {
    value: "telegram",
    label: "Telegram",
    logo: "/logo/telegram.svg",
    accent: "bg-[#2AABEE]/15 text-[#6FC6F5] ring-[#2AABEE]/25",
    description: "Send messages via bot",
  },
] as const;
type Platform = (typeof PLATFORMS)[number];
type PlatformValue = Platform["value"];
type CredentialField = {
  key: string;
  label: string;
  placeholder: string;
  inputType?: "password" | "text";
  advanced?: boolean;
  helperText?: string;
};
const PRIMARY_BUTTON =
  "bg-[#F04D26] text-white hover:bg-[#F04D26]/90 disabled:opacity-60";
const SECONDARY_BUTTON =
  "border-[#333333] bg-[#1d1d1d] text-[#e8e6e1] hover:bg-[#242424] hover:text-[#e8e6e1]";
const ICON_BUTTON =
  "shrink-0 rounded-lg p-2 text-[#87867c] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F04D26]";
function isPlatformValue(value: string | null): value is PlatformValue {
  return PLATFORMS.some((platform) => platform.value === value);
}
function getSafeReturnToPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}
function getKeyFields(platform: PlatformValue): CredentialField[] {
  switch (platform) {
    case "telegram":
      return [
        {
          key: "botToken",
          label: "Bot Token",
          placeholder: "123456789:ABC...",
        },
      ];
    case "openai":
      return [{ key: "apiKey", label: "API Key", placeholder: "sk-..." }];
    case "anthropic":
      return [{ key: "apiKey", label: "API Key", placeholder: "sk-ant-..." }];
    case "gemini":
      return [{ key: "apiKey", label: "API Key", placeholder: "AIza..." }];
    case "github":
      return [
        {
          key: "accessToken",
          label: "Personal Access Token",
          placeholder: "ghp_...",
        },
      ];
    case "notion":
      return [
        {
          key: "accessToken",
          label: "Integration Token",
          placeholder: "ntn_...",
        },
        {
          key: "workspacePageUrl",
          label: "Notion Page Link",
          placeholder: "https://www.notion.so/your-page-id",
          inputType: "text",
          helperText:
            "Paste a shared Notion page or database link. You can reuse this when configuring Notion nodes.",
        },
      ];
    case "slack":
      return [
        {
          key: "webhookUrl",
          label: "Webhook URL",
          placeholder: "https://hooks.slack.com/services/...",
        },
      ];
    default:
      return [{ key: "apiKey", label: "API Key", placeholder: "" }];
  }
}
function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function PlatformMark({
  platform,
  size = "default",
}: {
  platform: Platform;
  size?: "default" | "small";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg font-semibold ring-1 ring-inset",
        size === "default" ? "size-12 text-sm" : "size-8 text-xs",
        platform.accent,
      )}
    >
      {"icon" in platform ? (
        <platform.icon size={size === "default" ? 28 : 20} />
      ) : (
        <Image
          src={platform.logo}
          alt=""
          width={size === "default" ? 28 : 20}
          height={size === "default" ? 28 : 20}
          unoptimized
        />
      )}
    </span>
  );
}
function CredentialsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [credentials, setCredentials] = useState<CredentialSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const refreshCredentials = useCallback(async () => {
    const response = await api.credentials();
    setCredentials(response.credentials);
  }, []);
  useEffect(() => {
    let isCurrent = true;
    api
      .credentials()
      .then((response) => {
        if (isCurrent) setCredentials(response.credentials);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setRequestError(
            error instanceof Error
              ? error.message
              : "Failed to load credentials.",
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);
  const credentialsByPlatform = useMemo(() => {
    const map: Record<string, typeof credentials> = {};
    for (const c of credentials) {
      if (!map[c.platform]) map[c.platform] = [];
      map[c.platform]!.push(c);
    }
    return map;
  }, [credentials]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState<PlatformValue>("openai");
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [showAdvancedFields, setShowAdvancedFields] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [managePlatform, setManagePlatform] = useState<PlatformValue | null>(
    null,
  );
  const queryPlatform = searchParams.get("platform");
  const requestedPlatform = isPlatformValue(queryPlatform)
    ? queryPlatform
    : null;
  const shouldOpenCreate = searchParams.get("openCreate") === "1";
  const returnToPath = getSafeReturnToPath(searchParams.get("returnTo"));
  const queryKey = searchParams.toString();
  const handledQueryKeyRef = useRef<string | null>(null);
  const openCreateForPlatform = useCallback((platformValue: PlatformValue) => {
    setEditingId(null);
    setTitle("");
    setPlatform(platformValue);
    setKeys({});
    setShowAdvancedFields(false);
    setDialogOpen(true);
  }, []);
  function openEditDialog(credential: {
    id: string;
    title: string;
    platform: string;
  }) {
    setEditingId(credential.id);
    setTitle(credential.title);
    setPlatform(credential.platform as PlatformValue);
    setKeys({});
    setShowAdvancedFields(false);
    setDialogOpen(true);
  }
  useEffect(() => {
    if (
      !queryKey ||
      handledQueryKeyRef.current === queryKey ||
      !requestedPlatform
    ) {
      return;
    }
    handledQueryKeyRef.current = queryKey;
    if (shouldOpenCreate) {
      openCreateForPlatform(requestedPlatform);
      return;
    }
    setManagePlatform(requestedPlatform);
  }, [queryKey, requestedPlatform, shouldOpenCreate, openCreateForPlatform]);
  async function handleSave() {
    if (!title.trim()) return;
    setIsSaving(true);
    setRequestError(null);
    try {
      if (editingId) {
        const payload: {
          id: string;
          title?: string;
          keys?: Record<string, string>;
        } = {
          id: editingId,
          title: title.trim(),
        };
        const hasKeys = Object.values(keys).some((v) => v.trim() !== "");
        if (hasKeys) payload.keys = keys;
        await api.updateCredential(payload);
      } else {
        await api.createCredential({
          title: title.trim(),
          platform,
          keys,
        });
      }
      await refreshCredentials();
      setDialogOpen(false);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Failed to save credential.",
      );
    } finally {
      setIsSaving(false);
    }
  }
  async function handleDelete() {
    if (!deleteId) return;
    setIsDeleting(true);
    setRequestError(null);
    try {
      await api.deleteCredential(deleteId);
      await refreshCredentials();
      setDeleteId(null);
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Failed to delete credential.",
      );
    } finally {
      setIsDeleting(false);
    }
  }
  const dialogPlatformMeta = PLATFORMS.find((p) => p.value === platform);
  const managePlatformMeta = PLATFORMS.find((p) => p.value === managePlatform);
  const keyFields = useMemo(() => getKeyFields(platform), [platform]);
  const basicKeyFields = useMemo(
    () => keyFields.filter((field) => !field.advanced),
    [keyFields],
  );
  const advancedKeyFields = useMemo(
    () => keyFields.filter((field) => field.advanced),
    [keyFields],
  );
  const missingRequiredBasicFields = useMemo(
    () =>
      editingId
        ? []
        : basicKeyFields
            .filter((field) => !(keys[field.key] ?? "").trim())
            .map((field) => field.label),
    [basicKeyFields, editingId, keys],
  );
  const isSaveDisabled =
    isSaving || !title.trim() || missingRequiredBasicFields.length > 0;
  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto w-full max-w-[1120px] space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT_QUAD }}
        >
          <h1 className="font-display text-2xl tracking-tight text-white">
            Credentials
          </h1>
          <p className="mt-1 text-sm text-[#87867c]">
            Manage API keys and webhook URLs for your integrations
          </p>
        </motion.div>

        {requestError && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          >
            {requestError}
          </p>
        )}

        {returnToPath && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: EASE_OUT_QUAD }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3"
          >
            <p className="text-sm text-amber-200">
              Add the missing credentials, then return to complete template
              setup.
            </p>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push(returnToPath as never)}
              className={cn(SECONDARY_BUTTON, "shrink-0 px-3.5")}
            >
              Back to Template
            </Button>
          </motion.div>
        )}

        {isLoading ? (
          <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {PLATFORMS.map((platform) => (
              <Card
                key={platform.value}
                className="h-fit animate-pulse p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="size-12 shrink-0 rounded-lg bg-white/10" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 h-3.5 w-20 rounded bg-white/10" />
                    <div className="h-3 w-full rounded bg-white/5" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {PLATFORMS.map((p, index) => {
              const platformCreds = credentialsByPlatform[p.value] ?? [];
              return (
                <Card
                  key={p.value}
                  className="h-fit p-4 transition-colors hover:border-[#F04D26]/40 animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
                  style={{
                    animationDelay: `${index * 30}ms`,
                    animationFillMode: "both",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <PlatformMark platform={p} />
                      {platformCreds.length > 0 && (
                        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F04D26] px-1 text-[10px] font-semibold leading-none text-white">
                          {platformCreds.length}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="mb-0.5 text-sm font-semibold text-white">
                        {p.label}
                      </h3>
                      <p className="text-xs leading-tight text-[#87867c]">
                        {p.description}
                      </p>
                    </div>

                    <button
                      onClick={() => setManagePlatform(p.value)}
                      className={cn(ICON_BUTTON, "p-1.5")}
                      title="Manage keys"
                      aria-label={`Manage ${p.label} keys`}
                    >
                      <Settings
                        aria-hidden="true"
                        className="size-[18px]"
                      />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog
          open={!!managePlatform}
          onOpenChange={(open) => !open && setManagePlatform(null)}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <div className="mb-1 flex items-center gap-3">
                {managePlatformMeta && (
                  <PlatformMark platform={managePlatformMeta} size="small" />
                )}
                <DialogTitle>
                  Manage {managePlatformMeta?.label ?? ""} Keys
                </DialogTitle>
              </div>
              <DialogDescription>
                Add, edit, or delete your {managePlatformMeta?.label ?? ""}{" "}
                credentials.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {managePlatform &&
              credentialsByPlatform[managePlatform] &&
              credentialsByPlatform[managePlatform].length > 0 ? (
                <motion.div
                  className="space-y-3"
                  initial="hidden"
                  animate="show"
                  variants={{
                    hidden: {},
                    show: {
                      transition: { staggerChildren: 0.04, delayChildren: 0.1 },
                    },
                  }}
                >
                  {credentialsByPlatform[managePlatform]!.map((cred) => (
                    <motion.div
                      key={cred.id}
                      variants={{
                        hidden: { opacity: 0, y: 6 },
                        show: {
                          opacity: 1,
                          y: 0,
                          transition: { duration: 0.15, ease: EASE_OUT_QUAD },
                        },
                      }}
                      className="flex items-center justify-between rounded-lg border border-[#333333] bg-[#151515] p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">
                          {cred.title}
                        </p>
                        <p className="text-xs text-[#87867c]">
                          Added {formatDate(cred.createdAt)}
                        </p>
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => {
                            openEditDialog(cred);
                            setManagePlatform(null);
                          }}
                          className={ICON_BUTTON}
                          title="Edit name"
                          aria-label="Edit credential"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteId(cred.id);
                            setManagePlatform(null);
                          }}
                          className={cn(
                            ICON_BUTTON,
                            "hover:bg-red-500/15 hover:text-red-400",
                          )}
                          title="Delete"
                          aria-label="Delete credential"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  className="py-8 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: 0.1 }}
                >
                  <p className="text-sm text-[#87867c]">
                    No credentials added yet
                  </p>
                </motion.div>
              )}
            </div>

            <DialogFooter className="border-t border-[#333333] pt-4">
              <Button
                onClick={() => {
                  if (managePlatform) {
                    openCreateForPlatform(managePlatform);
                    setManagePlatform(null);
                  }
                }}
                className={PRIMARY_BUTTON}
              >
                <Plus aria-hidden="true" className="size-4" />
                Add New Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <div className="mb-1 flex items-center gap-3">
                {dialogPlatformMeta && (
                  <PlatformMark platform={dialogPlatformMeta} size="small" />
                )}
                <DialogTitle>
                  {editingId
                    ? `Edit ${dialogPlatformMeta?.label ?? ""} Credential`
                    : `Add ${dialogPlatformMeta?.label ?? ""} Credential`}
                </DialogTitle>
              </div>
              <DialogDescription>
                {editingId
                  ? "Update the credential details. Leave the key field empty to keep the existing value."
                  : `Add a new ${dialogPlatformMeta?.description?.toLowerCase() ?? "credential"}.`}
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`My ${dialogPlatformMeta?.label ?? ""} Key`}
                />
              </div>

              {basicKeyFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label>{field.label}</Label>
                  <Input
                    type={field.inputType ?? "password"}
                    value={keys[field.key] ?? ""}
                    onChange={(e) =>
                      setKeys((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    placeholder={
                      editingId
                        ? "Leave empty to keep current"
                        : field.placeholder
                    }
                  />
                  {field.helperText && (
                    <p className="text-xs text-[#87867c]">{field.helperText}</p>
                  )}
                </div>
              ))}

              {!editingId && missingRequiredBasicFields.length > 0 && (
                <p className="text-xs text-amber-400">
                  Required before save: {missingRequiredBasicFields.join(", ")}
                </p>
              )}

              {advancedKeyFields.length > 0 && (
                <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-[#87867c]">
                      Optional advanced OAuth fields
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowAdvancedFields((prev) => !prev)}
                      className="text-xs font-medium text-[#F04D26] transition-colors hover:text-[#ff6a47]"
                    >
                      {showAdvancedFields ? "Hide" : "Show"}
                    </button>
                  </div>

                  {showAdvancedFields &&
                    advancedKeyFields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <Label>{field.label}</Label>
                        <Input
                          type="password"
                          value={keys[field.key] ?? ""}
                          onChange={(e) =>
                            setKeys((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          placeholder={
                            editingId
                              ? "Leave empty to keep current"
                              : field.placeholder
                          }
                        />
                      </div>
                    ))}
                </div>
              )}

              <Button
                type="submit"
                disabled={isSaveDisabled}
                className={cn(PRIMARY_BUTTON, "w-full")}
              >
                {isSaving ? "Saving..." : editingId ? "Update" : "Save"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!deleteId}
          onOpenChange={(open) => !open && setDeleteId(null)}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Credential</DialogTitle>
              <DialogDescription>
                Are you sure? This action cannot be undone. Any workflow nodes
                using this credential will stop working.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteId(null)}
                className={SECONDARY_BUTTON}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
export default function CredentialsPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <CredentialsPageContent />
    </Suspense>
  );
}
