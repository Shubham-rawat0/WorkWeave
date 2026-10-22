"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface PageTitleContextValue {
  title: string | null;
  setTitle: (title: string | null) => void;
}

const PageTitleContext = createContext<PageTitleContextValue | null>(null);

export function usePageTitleContext(): PageTitleContextValue {
  const ctx = useContext(PageTitleContext);
  if (!ctx) {
    throw new Error("usePageTitleContext must be used within a <PageTitleProvider>");
  }
  return ctx;
}

/**
 * Sets the title shown by the home layout breadcrumb for the current page.
 * The title is cleared automatically when the page unmounts.
 */
export function usePageTitle(title: string | null | undefined): void {
  const { setTitle } = usePageTitleContext();

  useEffect(() => {
    setTitle(title ?? null);
    return () => setTitle(null);
  }, [setTitle, title]);
}

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const value = useMemo(() => ({ title, setTitle }), [title]);

  return (
    <PageTitleContext.Provider value={value}>
      {children}
    </PageTitleContext.Provider>
  );
}

export default PageTitleProvider;
