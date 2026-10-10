"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WorkflowBuilderVisual } from "./visuals/WorkflowBuilderVisual";
import { ReliableExecutionVisual } from "./visuals/ReliableExecutionVisual";
import { CheckpointRecoveryVisual } from "./visuals/CheckpointRecoveryVisual";
import { ExecutionVisibilityVisual } from "./visuals/ExecutionVisibilityVisual";

// ---------------------------------------------------------------------------
// Slide data
// ---------------------------------------------------------------------------
interface Slide {
  num: string;
  label: string;
  heading: string;
  description: string;
  tag: string | null; // null = confirmed implemented; string = status note
  Visual: React.ComponentType;
}

const SLIDES: Slide[] = [
  {
    num: "01",
    label: "Workflow Builder",
    heading: "Visual Workflow Builder",
    description:
      "Connect triggers, conditions, and actions in a clear visual graph. Design branching workflows using a node-based canvas — each step is configurable, composable, and easy to understand.",
    tag: null,
    Visual: WorkflowBuilderVisual,
  },
  {
    num: "02",
    label: "Reliable Execution",
    heading: "Reliable Execution",
    description:
      "Handle failures at the node level with automatic retries. Each node tracks its own retry count and error details, so the engine can resume processing without repeating already-completed steps.",
    tag: null,
    Visual: ReliableExecutionVisual,
  },
  {
    num: "03",
    label: "Checkpointing",
    heading: "Checkpointing and Recovery",
    description:
      "Preserve execution state at key points using the built-in locking mechanism. Interrupted runs can be identified and resumed from a known-good checkpoint where supported by the executor.",
    tag: "Execution checkpoint-based resume is partially implemented — the locking model is in place and resumption logic is in development.",
    Visual: CheckpointRecoveryVisual,
  },
  {
    num: "04",
    label: "Visibility",
    heading: "Execution Visibility",
    description:
      "Inspect every workflow run in detail. Each node records its start time, completion time, status, input, output, and retry count — giving you a full timeline of every execution.",
    tag: null,
    Visual: ExecutionVisibilityVisual,
  },
];

// ---------------------------------------------------------------------------
// Slide transition variants
// ---------------------------------------------------------------------------
const EASE = [0.23, 1, 0.32, 1] as const;

const variants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -28 : 28 }),
};

const reducedVariants = {
  enter: { opacity: 0, x: 0 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 0 },
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function FeaturesSection() {
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(1);
  const [paused, setPaused] = useState(false);
  const prefersReduced = useRef(false);

  useEffect(() => {
    prefersReduced.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  const goTo = useCallback(
    (next: number, d?: number) => {
      setDir(d ?? (next > active ? 1 : -1));
      setActive(next);
    },
    [active]
  );

  const prev = () => goTo((active - 1 + SLIDES.length) % SLIDES.length, -1);
  const next = () => goTo((active + 1) % SLIDES.length, 1);

  // Touch swipe
  const touchStart = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStart.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchStart.current = null;
  };

  const slide = SLIDES[active]!;
  const v = prefersReduced.current ? reducedVariants : variants;

  return (
    <section
      id="features"
      className="relative bg-[#151515] py-16 sm:py-20 md:py-24 lg:py-28 xl:py-32"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* ── Section header ─────────────────────────────────────────── */}
      <div className="mx-auto w-[90%] sm:w-[88%] md:w-[85%] lg:w-[80%] max-w-[1400px] px-4 sm:px-4 md:px-5 lg:px-6 xl:px-8">
        <div className="mb-10 sm:mb-12 md:mb-14">
          {/* Eyebrow */}
          <div className="mb-4 flex items-center gap-2">
            <span
              className="inline-flex h-6 items-center rounded-md border border-[#F04D26]/40 bg-[#F04D26]/8 px-2 text-[10px] font-semibold tracking-widest text-[#F04D26]/80"
              aria-label="Section: Features"
            >
              FEATURES
            </span>
          </div>

          <h2 className="font-serif text-2xl sm:text-3xl md:text-[32px] lg:text-[40px] xl:text-[44px] leading-tight tracking-tight text-white max-w-2xl">
            Everything you need to run reliable workflows.
          </h2>
          <p className="mt-4 max-w-xl text-sm sm:text-base lg:text-[15px] text-[#7D7D87] leading-relaxed font-sans">
            Build, execute, and monitor automated workflows with the tools to handle branching logic, failures, and long-running tasks.
          </p>
        </div>

        {/* ── Selector tabs ───────────────────────────────────────── */}
        <div
          role="tablist"
          aria-label="Feature slides"
          className="mb-8 sm:mb-10 flex flex-wrap gap-1 sm:gap-2 border-b border-[#252525]"
        >
          {SLIDES.map((s, i) => {
            const isActive = i === active;
            return (
              <button
                key={s.num}
                role="tab"
                aria-selected={isActive}
                aria-controls="feature-slide-panel"
                tabIndex={isActive ? 0 : -1}
                onClick={() => goTo(i)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") goTo((i + 1) % SLIDES.length, 1);
                  if (e.key === "ArrowLeft")  goTo((i - 1 + SLIDES.length) % SLIDES.length, -1);
                }}
                className={`group relative flex items-center gap-2 pb-3 pr-3 pl-1 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F04D26] rounded-t
                  ${isActive ? "text-white" : "text-[#5a5a57] hover:text-[#a1a1a0]"}`}
              >
                <span
                  className={`text-[10px] font-mono ${isActive ? "text-[#F04D26]" : "text-[#3a3a38] group-hover:text-[#5a5a57]"}`}
                >
                  {s.num}
                </span>
                {s.label}

                {/* Active underline */}
                {isActive && (
                  <motion.span
                    layoutId="tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#F04D26]"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Main slide panel ─────────────────────────────────────── */}
        <div
          id="feature-slide-panel"
          role="tabpanel"
          aria-label={slide.heading}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={active}
              custom={dir}
              variants={v}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: EASE }}
              className="grid md:grid-cols-2 gap-8 md:gap-10 lg:gap-14 xl:gap-16 items-start"
            >
              {/* Left: text */}
              <div className="flex flex-col justify-start md:pt-2">
                <h3 className="text-xl sm:text-2xl lg:text-[26px] xl:text-[28px] font-semibold text-white leading-snug tracking-tight mb-4">
                  {slide.heading}
                </h3>
                <p className="text-sm sm:text-[15px] lg:text-base text-[#8a8a87] leading-relaxed mb-6 max-w-md">
                  {slide.description}
                </p>

                {/* Implementation note */}
                {slide.tag && (
                  <div className="mb-6 rounded-lg border border-[#3a3520] bg-[#2a2510]/50 px-3 py-2.5 text-[11px] text-[#a09060] leading-relaxed">
                    <span className="font-semibold text-[#c4a96b]">In development: </span>
                    {slide.tag}
                  </div>
                )}

                {/* Nav controls */}
                <div className="flex items-center gap-3 mt-auto pt-2">
                  <button
                    onClick={prev}
                    aria-label="Previous feature"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2e2e2e] bg-[#1e1e1e] text-[#6a6a67] transition-colors hover:border-[#3a3a38] hover:text-[#a1a1a0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F04D26]"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    onClick={next}
                    aria-label="Next feature"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2e2e2e] bg-[#1e1e1e] text-[#6a6a67] transition-colors hover:border-[#3a3a38] hover:text-[#a1a1a0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F04D26]"
                  >
                    <ChevronRight size={15} />
                  </button>

                  {/* Progress dots */}
                  <div className="flex items-center gap-1.5 ml-1" aria-hidden="true">
                    {SLIDES.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => goTo(i)}
                        aria-label={`Go to slide ${i + 1}`}
                        className={`rounded-full transition-all duration-300 ${
                          i === active
                            ? "w-4 h-1.5 bg-[#F04D26]"
                            : "w-1.5 h-1.5 bg-[#3a3a38] hover:bg-[#5a5a57]"
                        }`}
                      />
                    ))}
                  </div>

                  <span className="ml-auto text-[11px] text-[#3d3d3b] font-mono tabular-nums select-none">
                    {String(active + 1).padStart(2, "0")} / {String(SLIDES.length).padStart(2, "0")}
                  </span>
                </div>
              </div>

              {/* Right: visual */}
              <div className="w-full rounded-xl border border-[#272727] bg-[#1c1c1c] overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.4)]"
                style={{ aspectRatio: "480 / 320" }}>
                <slide.Visual />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

