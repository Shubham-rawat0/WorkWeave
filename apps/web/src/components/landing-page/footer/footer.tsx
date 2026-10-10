
"use client";

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { ChevronDown, Workflow } from "lucide-react";

const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

const footerGroups = [
  {
    title: "Product",
    items: ["Workflows", "Integrations", "Templates", "Executions"],
  },
  {
    title: "Resources",
    items: ["Documentation", "Getting started", "Examples", "Changelog"],
  },
  {
    title: "Developers",
    items: ["API reference", "Webhooks", "Credentials", "Run history"],
  },
  {
    title: "Platform",
    items: ["Self-hosting", "Security", "Settings", "Status"],
  },
];

function BrandMark() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F04D26] text-xl font-black text-white shadow-sm shadow-[#F04D26]/20">
      W
    </span>
  );
}

function FooterGroup({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-5 text-sm font-semibold tracking-wide text-[var(--surface-text)]">
        {title}
      </h3>

      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item}>
            <a
              href=""
              className="text-sm text-[var(--nav-text)] transition-colors hover:text-[var(--surface-text)]"
            >
              {item}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MobileFooterGroup({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <Collapsible>
      <CollapsibleTrigger
        className="
          group flex w-full items-center justify-between
          py-4 text-left
          focus-visible:outline-2 focus-visible:outline-[#F04D26]
        "
      >
        <span className="text-sm font-semibold text-[var(--surface-text)]">
          {title}
        </span>

        <span className="flex size-7 items-center justify-center rounded-full border border-[var(--surface-text)]/10 transition-colors group-hover:bg-[var(--surface-text)]/[0.06]">
          <ChevronDown
            aria-hidden="true"
            className="size-4 text-[var(--nav-text)] transition-transform duration-200 group-data-[state=open]:rotate-180"
          />
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
        <ul className="space-y-3 pb-5">
          {items.map((item) => (
            <li key={item}>
              <a
                href=""
                className="block text-sm text-[var(--nav-text)] transition-colors hover:text-[var(--surface-text)]"
              >
                {item}
              </a>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden pt-12 sm:pt-16">
      {/* Top border */}
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="h-px w-full bg-[var(--surface-text)]/10" />

        {/* Main footer */}
        <div className="grid gap-12 py-12 lg:grid-cols-[1.1fr_2fr] lg:gap-16 lg:py-16">
          {/* Brand section */}
          <div className="flex flex-col items-start">
            <a
              href=""
              aria-label="WorkOrchestrator"
              className="group inline-flex items-center gap-3"
            >
              <BrandMark />

              <span className="text-lg font-bold tracking-tight text-[var(--surface-text)]">
                WorkOrchestrator
              </span>
            </a>

            <p className="mt-5 max-w-sm text-sm leading-7 text-[var(--nav-text)]">
              Build, connect, and automate your workflows. Bring your
              integrations and actions together in one place.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[var(--surface-text)]/10 px-3 py-1.5">
              <span className="size-1.5 rounded-full bg-[#F04D26]" />
              <span className="text-xs font-medium text-[var(--nav-text)]">
                Workflow automation platform
              </span>
            </div>
          </div>

          {/* Desktop footer columns */}
          <div className="hidden grid-cols-4 gap-6 md:grid lg:gap-8">
            {footerGroups.map((group) => (
              <FooterGroup
                key={group.title}
                title={group.title}
                items={group.items}
              />
            ))}
          </div>

          {/* Mobile and tablet accordion */}
          <div className="divide-y divide-[var(--surface-text)]/10 border-y border-[var(--surface-text)]/10 md:hidden">
            {footerGroups.map((group) => (
              <MobileFooterGroup
                key={group.title}
                title={group.title}
                items={group.items}
              />
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-4 border-t border-[var(--surface-text)]/10 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--nav-text)]">
            © {currentYear} WorkOrchestrator. All rights reserved.
          </p>

          <div className="flex items-center gap-2 text-xs text-[var(--nav-text)]">
            <Workflow aria-hidden="true" className="size-3.5" />
            <span>Built for reliable automation</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
