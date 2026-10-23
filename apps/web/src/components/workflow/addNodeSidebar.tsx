"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  getNodesByCategory,
  type NodeCategory,
  type NodeDefinition,
} from "@WorkOrchestrator/shared/nodeRegistry";
import { getNodeIcon } from "./nodeIcons";

interface AddNodeSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddNode: (type: string) => void;
}

export function AddNodeSidebar({
  open,
  onOpenChange,
  onAddNode,
}: AddNodeSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<NodeCategory>>(
    new Set(),
  );

  const filteredGrouped = useMemo(() => {
    const grouped = getNodesByCategory();
    const query = searchQuery.trim().toLowerCase();

    return CATEGORY_ORDER.reduce(
      (acc, category) => {
        acc[category] = grouped[category].filter(
          (node) =>
            !query ||
            node.label.toLowerCase().includes(query) ||
            node.description.toLowerCase().includes(query),
        );
        return acc;
      },
      {} as Record<NodeCategory, NodeDefinition[]>,
    );
  }, [searchQuery]);

  const query = searchQuery.trim().toLowerCase();

  function toggleCategory(category: NodeCategory) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  function handleAddNode(type: string) {
    onAddNode(type);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
              onChange={(event) => setSearchQuery(event.target.value)}
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
                        onClick={() => handleAddNode(node.type)}
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
  );
}
