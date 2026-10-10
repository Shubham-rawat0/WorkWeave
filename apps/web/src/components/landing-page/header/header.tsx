"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { SideLine } from "./sideLine";
import WLogo from "./w-logo";

const NAV_ITEMS = [
  { label: "Features", id: "features" },
  { label: "Playground", id: "playground" },
  { label: "Templates", id: "templates" },
];

const EASE = [0.23, 1, 0.32, 1] as const;

const getViewport = () =>
  document.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');

const handleSmoothScroll = (
  e: React.MouseEvent<HTMLAnchorElement>,
  targetId: string,
) => {
  e.preventDefault();
  const element = document.getElementById(targetId);
  if (!element) return;

  const viewport = element.closest<HTMLElement>(
    '[data-slot="scroll-area-viewport"]',
  );
  if (viewport) {
    const viewportRect = viewport.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const baseTop = viewport.scrollTop + (elementRect.top - viewportRect.top);
    const sectionOverflow = Math.max(
      0,
      elementRect.height - viewport.clientHeight,
    );
    const overflowCompensation =
      sectionOverflow > 0 ? Math.min(sectionOverflow, 96) : 0;
    viewport.scrollTo({
      top: Math.max(0, baseTop + overflowCompensation),
      behavior: "smooth",
    });
    return;
  }
  element.scrollIntoView({ behavior: "smooth", block: "start" });
};

const NodeSvg = () => (
  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden="true">
    <rect x="0.5" y="0.5" width="8" height="8" rx="2" fill="#F04D26" />
  </svg>
);

export default function Header() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Scroll-spy: highlight the section currently in view
  useEffect(() => {
    const root = getViewport();
    const targets = NAV_ITEMS.map((i) => document.getElementById(i.id)).filter(
      (el): el is HTMLElement => !!el,
    );
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { root, rootMargin: "-30% 0px -50% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  // Close the mobile menu on Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    // Sticky wrapper: only the pill itself captures pointer events,
    // so the transparent strip around it never blocks the page underneath.
    <div className="pointer-events-none sticky top-0 z-50 flex flex-col items-center pt-2 md:pt-3">
      <div className="relative flex w-full items-center justify-center gap-6 px-3 lg:gap-8 lg:px-0">
        <div className="pointer-events-none absolute inset-0 mx-auto hidden w-[80%] max-w-[1920px] lg:block">
          <div className="absolute left-2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
            <NodeSvg />
          </div>
          <div className="absolute right-2 top-1/2 z-30 translate-x-1/2 -translate-y-1/2">
            <NodeSvg />
          </div>
        </div>

        <SideLine side="left" />

        <header className="pointer-events-auto relative z-10 flex h-16 w-full max-w-[calc(100vw-1.5rem)] items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[var(--surface)]/35 px-3 text-[var(--surface-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)] backdrop-blur-2xl backdrop-saturate-150 supports-[not(backdrop-filter)]:bg-[var(--surface)]/90 sm:w-[90%] md:w-[85%] md:shadow-lg md:shadow-black/20 lg:h-auto lg:w-auto lg:rounded-[20px] lg:p-2">
          {/* Logo */}
          <Link
            href="/"
            aria-label="WorkOrchestrator home"
            className="group flex shrink-0 items-center rounded-xl pl-1 pr-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F04D26] lg:pl-1.5"
          >
            <WLogo className="h-10 w-10" />
          </Link>

          {/* Desktop nav with sliding hover highlight */}
          <nav
            aria-label="Primary"
            className="mx-3 hidden items-center gap-0.5 lg:flex"
            onMouseLeave={() => setHovered(null)}
          >
            {NAV_ITEMS.map((item) => {
              const isActive = active === item.id;
              return (
                <Link
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => handleSmoothScroll(e, item.id)}
                  onMouseEnter={() => setHovered(item.id)}
                  onFocus={() => setHovered(item.id)}
                  onBlur={() => setHovered(null)}
                  aria-current={isActive ? "location" : undefined}
                  className={`relative rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[#F04D26] motion-reduce:transition-none ${
                    isActive || hovered === item.id
                      ? "text-[var(--surface-text)]"
                      : "text-[var(--nav-text)]"
                  }`}
                >
                  {hovered === item.id && (
                    <motion.span
                      layoutId="nav-hover"
                      className="absolute inset-0 rounded-lg bg-white/[0.08]"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 38,
                      }}
                    />
                  )}
                  <span className="relative">{item.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#F04D26]"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 38,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1.5 pr-0.5 lg:pr-1">
            <motion.a
              href="/home"
              initial="idle"
              whileHover="hover"
              className="group flex h-8 items-center gap-1.5 rounded-[10px] bg-[#F04D26] px-3 text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_18px_-8px_rgba(240,77,38,0.9)] transition-[background-color,transform] duration-150 hover:bg-[#F04D26]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.97] motion-reduce:transition-none"
            >
              <span>Login</span>
              <svg
                viewBox="0 0 32 32"
                fill="none"
                aria-hidden="true"
                className="h-4 w-4 text-white/80 transition-colors group-hover:text-white"
              >
                <path
                  opacity="0.4"
                  d="M26.2214 29.3337H14.6658C12.9506 29.3337 11.5547 27.9377 11.5547 26.2225V5.7781C11.5547 4.0629 12.9506 2.66699 14.6658 2.66699H26.2214C27.9366 2.66699 29.3325 4.0629 29.3325 5.7781V26.2225C29.3325 27.9377 27.9366 29.3337 26.2214 29.3337Z"
                  fill="currentColor"
                />
                <path
                  d="M19.5547 9.87893V22.1219C19.5547 23.2044 20.1033 24.1923 21.0251 24.766L27.7325 28.925C28.6829 28.392 29.3341 27.3868 29.3341 26.2218V5.77742C29.3341 4.61333 28.6834 3.60817 27.7339 3.0752L21.0251 7.23411C20.1049 7.80531 19.5547 8.79377 19.5547 9.87893Z"
                  fill="currentColor"
                />
                <motion.path
                  d="M12.9422 15.0579L8.05333 10.169C7.53244 9.6481 6.68798 9.6481 6.16709 10.169C5.6462 10.6899 5.6462 11.5343 6.16709 12.0552L8.78044 14.6685H1.33333C0.597333 14.6685 0 15.2659 0 16.0019C0 16.7379 0.597333 17.3352 1.33333 17.3352H8.78044L6.16709 19.9486C5.6462 20.4694 5.6462 21.3139 6.16709 21.8348C6.42665 22.0943 6.76798 22.2259 7.10932 22.2259C7.45065 22.2259 7.79198 22.0961 8.05154 21.8348L12.9404 16.9459C13.4613 16.425 13.4613 15.5805 12.9404 15.0597L12.9422 15.0579Z"
                  fill="currentColor"
                  variants={{
                    idle: { x: 0, opacity: 0.8 },
                    hover: { x: 3, opacity: 1 },
                  }}
                  transition={{ duration: 0.2, ease: EASE }}
                />
              </svg>
            </motion.a>

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-[var(--surface-text)] transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F04D26] lg:hidden"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 8h16M4 16h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile dropdown */}
          <AnimatePresence>
            {menuOpen && (
              <motion.nav
                id="mobile-menu"
                aria-label="Mobile"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.18, ease: EASE }}
                style={{ transformOrigin: "top" }}
                className="absolute left-0 right-0 top-full mt-2 flex flex-col gap-1 rounded-2xl border border-white/10 bg-[var(--surface)]/95 p-2 shadow-xl shadow-black/25 lg:hidden"
              >
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.id}
                    href={`#${item.id}`}
                    onClick={(e) => {
                      handleSmoothScroll(e, item.id);
                      setMenuOpen(false);
                    }}
                    className={`flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-medium transition-colors hover:bg-white/[0.07] ${
                      active === item.id
                        ? "text-[var(--surface-text)]"
                        : "text-[var(--nav-text)]"
                    }`}
                  >
                    {item.label}
                    {active === item.id && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#F04D26]" />
                    )}
                  </Link>
                ))}
              </motion.nav>
            )}
          </AnimatePresence>
        </header>

        <SideLine side="right" />
      </div>
    </div>
  );
}
