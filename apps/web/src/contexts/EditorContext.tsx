"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface EditorContextValue {
  onUpdateNodeData: (nodeId: string, data: Record<string, unknown>) => void;
  onDeleteNode: (nodeId: string) => void;
  getNodeData: (nodeId: string) => Record<string, unknown>;
  nodeStatuses: Record<string, string>;
  onExecuteNode: (nodeId: string) => void;
  onExecuteWorkflow: () => void;
  onOpenNodeConfig: (nodeId: string, nodeType: string) => void;
  canEditNodes: boolean;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error("useEditor must be used within an <EditorProvider>");
  }
  return ctx;
}

export function EditorProvider({
  children,
  ...value
}: EditorContextValue & { children: ReactNode }) {
  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

export default EditorProvider;