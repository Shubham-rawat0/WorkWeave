"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { Plus, ChevronDown, ChevronRight, Search, Zap, Globe, GitBranch, Filter, Clock, FileText, Wand2, Webhook, Timer } from "lucide-react";
import { Input } from "@/components/ui/input";
import OpenAI from "@lobehub/icons/es/OpenAI";
import Anthropic from "@lobehub/icons/es/Anthropic";
import Gemini from "@lobehub/icons/es/Gemini";
import Github from "@lobehub/icons/es/Github";
import Notion from "@lobehub/icons/es/Notion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getNodesByCategory,
  type NodeCategory,
} from "@WorkOrchestrator/shared/nodeRegistry";

function getNodeIcon(type: string): ReactNode {
  const size = 16;
  switch (type) {
    case "manualTrigger":
      return <Zap className="size-4 text-amber-400" />;
    case "webhookTrigger":
      return <Webhook className="size-4 text-blue-400" />;
    case "cronTrigger":
      return <Clock className="size-4 text-purple-400" />;
    case "httpTrigger":
      return <Globe className="size-4 text-sky-400" />;
    case "githubNode":
      return <Github size={size} />;
    case "notionNode":
      return <Notion size={size} />;
    case "openaiNode":
      return <OpenAI size={size} />;
    case "geminiNode":
      return <Gemini size={size} />;
    case "anthropicNode":
      return <Anthropic size={size} />;
    case "slackNode":
      return (
        <img
          src="/logo/slack.svg"
          alt=""
          width={size}
          height={size}
          className="size-4"
        />
      );
    case "conditionNode":
      return <GitBranch className="size-4 text-emerald-400" />;
    case "filterNode":
      return <Filter className="size-4 text-emerald-400" />;
    case "delayNode":
      return <Timer className="size-4 text-orange-400" />;
    case "logNode":
      return <FileText className="size-4 text-gray-400" />;
    case "transformNode":
      return <Wand2 className="size-4 text-pink-400" />;
    default:
      return <Globe className="size-4 text-gray-400" />;
  }
}

export default function WorkflowPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [workflowName, setWorkflowName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<NodeCategory>>(
    new Set(),
  );

  usePageTitle(error ? "Workflow unavailable" : (workflowName ?? "Loading…"));

  useEffect(() => {
    let cancelled = false;
    setWorkflowName(null);
    setError(null);
    api
      .workflow(id)
      .then(({ workflow }) => {
        if (!cancelled) setWorkflowName(workflow.title);
      })
      .catch((requestError: unknown) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Failed to load workflow.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const grouped = getNodesByCategory();
  const query = searchQuery.trim().toLowerCase();
  const filteredGrouped = CATEGORY_ORDER.reduce(
    (acc, category) => {
      const nodes = grouped[category].filter(
        (node) =>
          !query ||
          node.label.toLowerCase().includes(query) ||
          node.description.toLowerCase().includes(query),
      );
      acc[category] = nodes;
      return acc;
    },
    {} as Record<NodeCategory, typeof grouped[NodeCategory]>,
  );

  function toggleCategory(category: NodeCategory) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  return (
    <div
      className="relative min-h-full w-full bg-black bg-[radial-gradient(circle,#333333_1px,transparent_1px)] [background-size:20px_20px]"
      style={{
        backgroundColor: "#141414",
        backgroundImage: "radial-gradient(circle, #333333 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="absolute top-4 right-4 z-20 flex size-10 items-center justify-center rounded-full bg-[#F04D26] text-white shadow-lg transition-colors hover:bg-[#E63D00] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F04D26]"
        aria-label="Add node"
      >
        <Plus className="size-5" />
      </button>

      {error && (
        <p
          role="alert"
          className="relative z-10 mx-6 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {error}
        </p>
      )}

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="right"
          className="w-[360px] rounded-tl-2xl border-white/10 bg-[#111111] text-white sm:max-w-[360px]"
        >
          <SheetHeader>
            <SheetTitle className="text-white">Add Node</SheetTitle>
            <SheetDescription className="text-[#87867c]">
              Choose a node to add to your workflow
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#87867c]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search nodes..."
                className="h-9 border-white/10 bg-white/[0.04] pl-9 text-sm text-white placeholder:text-[#87867c]"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {CATEGORY_ORDER.map((category) => {
              const nodes = filteredGrouped[category];
              if (nodes.length === 0) return null;
              const isOpen = openCategories.has(category) || query.length > 0;
              return (
                <div
                  key={category}
                  className="mb-2 rounded-lg border border-white/10 bg-white/[0.02]"
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-white"
                  >
                    <span>{CATEGORY_LABELS[category]}</span>
                    {isOpen ? (
                      <ChevronDown className="size-4 text-[#87867c]" />
                    ) : (
                      <ChevronRight className="size-4 text-[#87867c]" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="space-y-1 border-t border-white/10 p-2">
                      {nodes.map((node) => (
                        <button
                          key={node.type}
                          type="button"
                          onClick={() => setSidebarOpen(false)}
                          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/5"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/5">
                            {getNodeIcon(node.type)}
                          </span>
                          <span className="flex flex-col">
                            <span className="text-sm font-medium text-white">
                              {node.label}
                            </span>
                            <span className="text-xs text-[#87867c]">
                              {node.description}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
