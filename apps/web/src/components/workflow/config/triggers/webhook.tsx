"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Globe2, Link2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  ConfigFooter,
  ResponseNameField,
  type ConfigProps,
} from "../shared/formFields";

export function WebhookTriggerConfig({
  data,
  onSave,
  webhookUrl,
}: ConfigProps & { webhookUrl?: string }) {
  const [responseName, setResponseName] = useState(data.responseName || "");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function handleCopyUrl() {
    if (!webhookUrl) return;
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
    } catch {
      setCopyError("Could not copy URL. Select and copy it manually.");
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      secret: undefined,
      routeKey: undefined,
      responseName: responseName || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3 rounded-xl border border-[#333333] bg-[#1a1a1a] p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#F04D26]/10 text-[#F04D26]">
            <Globe2 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <Label className="text-sm font-medium text-[#e8e6e1]">
              Webhook endpoint
            </Label>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              Send an HTTP request to this unique URL to start the workflow.
            </p>
          </div>
        </div>
        {webhookUrl ? (
          <>
            <div className="min-w-0 rounded-lg border border-[#383838] bg-[#111111] p-2">
              <div
                aria-label="Webhook URL"
                className="min-w-0 break-all font-mono text-xs leading-relaxed text-white/75"
              >
                {webhookUrl}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-[#383838] pt-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] text-white/40">
                  <Link2 className="size-3.5" />
                  Private endpoint
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyUrl()}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[#3b3b3b] bg-[#242424] px-2.5 text-xs font-medium text-[#e8e6e1] transition-colors hover:border-[#F04D26]/50 hover:bg-[#2d2d2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F04D26]"
                  aria-label={copied ? "Webhook URL copied" : "Copy webhook URL"}
                >
                  {copied ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            {copyError ? (
              <p role="alert" className="text-xs text-red-400">
                {copyError}
              </p>
            ) : null}
            <p className="text-xs text-white/40">
              Keep this URL private. Anyone with it can trigger this workflow.
            </p>
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-[#3b3b3b] px-3 py-2.5 text-xs text-white/50">
            Save the workflow to generate its unique webhook URL.
          </p>
        )}
      </div>
      <ResponseNameField value={responseName} onChange={setResponseName} />
      <ConfigFooter missingFields={[]} disabled={false} />
    </form>
  );
}
