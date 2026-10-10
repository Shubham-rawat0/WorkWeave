
const NodeSvg = () => (
  <svg
    aria-hidden="true"
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    className="shrink-0"
  >
    <rect
      x="1"
      y="1"
      width="8"
      height="8"
      rx="2.5"
      fill="var(--surface)"
      stroke="#F04D26"
      strokeWidth="1.2"
    />
    <rect
      x="3.5"
      y="3.5"
      width="3"
      height="3"
      rx="1"
      fill="#F04D26"
    />
  </svg>
);

const LogoSvg = () => (
  <svg
    aria-hidden="true"
    width="38"
    height="38"
    viewBox="0 0 38 38"
    fill="none"
    className="shrink-0"
  >
    <defs>
      <linearGradient id="workflow-logo-gradient" x1="4" y1="3" x2="34" y2="35">
        <stop offset="0%" stopColor="#FF784F" />
        <stop offset="100%" stopColor="#F04D26" />
      </linearGradient>
    </defs>

    <rect
      x="1"
      y="1"
      width="36"
      height="36"
      rx="11"
      fill="var(--surface)"
      stroke="#F04D26"
      strokeOpacity=".45"
    />

    <rect
      x="4"
      y="4"
      width="30"
      height="30"
      rx="8"
      fill="url(#workflow-logo-gradient)"
      fillOpacity=".10"
    />

    <path
      d="M9.5 11.5L13.5 26.5H17.1L19 19.5L20.9 26.5H24.5L28.5 11.5H24.4L22.5 20L20.4 13.5H17.6L15.5 20L13.6 11.5H9.5Z"
      fill="url(#workflow-logo-gradient)"
    />
  </svg>
);

const ConnectorLine = ({ wide = false }: { wide?: boolean }) => (
  <div
    aria-hidden="true"
    className={`
      relative h-px shrink-0
      bg-gradient-to-r from-transparent via-[var(--surface-text)]/25 to-transparent
      ${wide ? "w-20 sm:w-28 2xl:w-40" : "w-8 sm:w-12"}
    `}
  >
    <span className="absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F04D26]/60" />
  </div>
);

export function SectionSeparators() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative z-20 mx-auto flex w-full items-center justify-center py-3"
    >
      {/* Compact mobile composition */}
      <div className="flex items-center justify-center sm:hidden">
        <NodeSvg />
        <ConnectorLine />
        <NodeSvg />
        <div className="mx-3">
          <LogoSvg />
        </div>
        <NodeSvg />
        <ConnectorLine />
        <NodeSvg />
      </div>

      {/* Wider desktop composition */}
      <div className="hidden items-center justify-center sm:flex">
        <NodeSvg />
        <ConnectorLine wide />
        <NodeSvg />

        <div className="mx-4">
          <LogoSvg />
        </div>

        <NodeSvg />
        <ConnectorLine wide />
        <NodeSvg />
      </div>
    </div>
  );
}
