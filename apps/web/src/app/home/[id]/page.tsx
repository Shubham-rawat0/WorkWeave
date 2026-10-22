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
    <div className="min-h-full">
      {error && (
        <p
          role="alert"
          className="mx-6 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}
