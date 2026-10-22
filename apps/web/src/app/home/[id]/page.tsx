"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { usePageTitle } from "@/contexts/PageTitleContext";

export default function WorkflowPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [workflowName, setWorkflowName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div
      className="relative min-h-full w-full bg-black bg-[radial-gradient(circle,#333333_1px,transparent_1px)] [background-size:20px_20px]"
      style={{
        backgroundColor: "#141414",
        backgroundImage: "radial-gradient(circle, #333333 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      {error && (
        <p
          role="alert"
          className="relative z-10 mx-6 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}
