/** Stylized "W" mark: a node-graph W that reads as a "W" and as an orchestration flow. */
export default function WLogo({
  className = "h-8 w-8",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M7 10.4 L11.7 21.6 L16 14 L20.3 21.6 L25 10.4"
        stroke="#F04D26"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g fill="#F04D26">
        <circle cx="7" cy="10.4" r="2.1" />
        <circle cx="11.7" cy="21.6" r="2.1" />
        <circle cx="16" cy="14" r="2.1" />
        <circle cx="20.3" cy="21.6" r="2.1" />
        <circle cx="25" cy="10.4" r="2.1" />
      </g>
    </svg>
  );
}
