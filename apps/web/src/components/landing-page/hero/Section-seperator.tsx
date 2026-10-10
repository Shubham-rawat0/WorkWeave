const NodeSvg = () => (
  <svg
    aria-hidden="true"
    width="12"
    height="12"
    viewBox="0 0 10 10"
    fill="none"
    className="shrink-0"
  >
    <rect
      x="1"
      y="1"
      width="8"
      height="8"
      rx="2.25"
      fill="var(--surface)"
      stroke="var(--nav-text)"
      strokeOpacity=".35"
      strokeWidth=".75"
    />
    <rect x="3.5" y="3.5" width="3" height="3" rx="1" fill="#F04D26" />
  </svg>
);

const ConnectorLine = ({ wide = false }: { wide?: boolean }) => (
  <div
    aria-hidden="true"
    className={`
      relative h-px shrink-0
      bg-gradient-to-r from-transparent via-[var(--nav-text)]/35 to-[var(--nav-text)]/55
      ${wide ? "w-16 sm:w-28 2xl:w-44" : "w-6 sm:w-10"}
    `}
  >
    <span className="absolute right-0 top-1/2 size-[3px] -translate-y-1/2 rounded-full bg-[#F04D26]" />
  </div>
);

export function SectionSeparators() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative z-20 mx-auto flex w-full items-center justify-center py-6 sm:py-8"
    >
      {/* Mobile composition */}
      <div className="flex items-center justify-center sm:hidden">
        <NodeSvg />
        <ConnectorLine />
        <div className="mx-2 size-1.5 rounded-full bg-[#F04D26]/80" />
        <ConnectorLine />
        <NodeSvg />
      </div>

      {/* Desktop composition */}
      <div className="hidden items-center justify-center sm:flex">
        <NodeSvg />
        <ConnectorLine wide />
        <NodeSvg />
        <ConnectorLine wide />
        <div className="mx-3 size-2 rounded-full bg-[#F04D26]" />
        <ConnectorLine wide />
        <NodeSvg />
        <ConnectorLine wide />
        <NodeSvg />
      </div>
    </div>
  );
}
