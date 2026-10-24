"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useEditor } from "@/contexts/EditorContext";

type FieldType = "text" | "textarea" | "select";

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
}

interface TypeConfig {
  label: string;
  fields: FieldDef[];
}

const TYPE_CONFIGS: Record<string, TypeConfig> = {
  manualTrigger: {
    label: "Manual trigger",
    fields: [{ key: "label", label: "Name", type: "text" }],
  },
  openaiNode: {
    label: "OpenAI task",
    fields: [
      { key: "label", label: "Name", type: "text" },
      { key: "model", label: "Model", type: "text" },
      { key: "prompt", label: "Prompt", type: "textarea" },
    ],
  },
  conditionNode: {
    label: "Condition",
    fields: [
      { key: "label", label: "Name", type: "text" },
      {
        key: "demoRoute",
        label: "Demo route",
        type: "select",
        options: ["alert", "log"],
      },
    ],
  },
  slackNode: {
    label: "Slack message",
    fields: [
      { key: "label", label: "Name", type: "text" },
      { key: "message", label: "Message", type: "textarea" },
    ],
  },
  logNode: {
    label: "Log",
    fields: [
      { key: "label", label: "Name", type: "text" },
      {
        key: "level",
        label: "Level",
        type: "select",
        options: ["info", "warn", "error"],
      },
      { key: "message", label: "Message", type: "textarea" },
    ],
  },
};

interface PlaygroundNodeConfigDialogProps {
  open: boolean;
  nodeId: string | null;
  nodeType: string | null;
  nodeData: Record<string, unknown> | null;
  onOpenChange: (open: boolean) => void;
  onSave: (nodeId: string, data: Record<string, unknown>) => void;
}

export function PlaygroundNodeConfigDialog({
  open,
  nodeId,
  nodeType,
  nodeData,
  onOpenChange,
  onSave,
}: PlaygroundNodeConfigDialogProps) {
  const { deleteNode } = useEditor();
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && nodeData) {
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(nodeData)) {
        if (typeof value === "string" || typeof value === "number") {
          next[key] = String(value);
        }
      }
      setDraft(next);
    }
  }, [open, nodeData]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open || !nodeId || !nodeType) return null;

  const config = TYPE_CONFIGS[nodeType] ?? {
    label: nodeType,
    fields: [{ key: "label", label: "Name", type: "text" as const }],
  };

  const setField = (key: string, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const handleSave = () => {
    onSave(nodeId, draft);
    onOpenChange(false);
  };

  const handleDelete = () => {
    deleteNode(nodeId);
    onOpenChange(false);
  };

  const inputClass =
    "w-full rounded-lg border border-[#333333] bg-[#1a1a1a] px-3 py-2 text-sm text-[#d6d6d2] placeholder:text-[#5a5a57] focus:border-[#F04D26] focus:outline-none";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Configure ${config.label}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto scrollbar-thin rounded-2xl border border-[#333333] bg-[#1e1e1e] p-5 shadow-[0_16px_60px_rgba(0,0,0,0.6)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            Configure {config.label}
          </h3>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="flex size-6 items-center justify-center rounded-md text-[#8a8a87] transition-colors hover:bg-[#2a2a2a] hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="none"
              className="size-3.5"
            >
              <path
                d="M3.5 3.5l9 9m0-9l-9 9"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {config.fields.map((field) => (
            <label key={field.key} className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#8a8a87]">
                {field.label}
              </span>
              {field.type === "textarea" ? (
                <textarea
                  value={draft[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              ) : field.type === "select" ? (
                <select
                  value={draft[field.key] ?? field.options?.[0] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className={inputClass}
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={draft[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                  className={inputClass}
                />
              )}
            </label>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-lg border border-[#3a2020] bg-[#2a1515]/60 px-3 py-2 text-xs font-medium text-[#b56a6a] transition-colors hover:border-[#4f2a2a] hover:bg-[#331a1a]"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-[#333333] bg-[#262626] px-4 py-2 text-xs font-medium text-[#a1a1a0] transition-colors hover:bg-[#2e2e2e]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-[#F04D26] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#F04D26]/90"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}