// Brand mark: a tiny dependency graph (two source nodes feeding one calculated
// node) inside a rounded sky→green badge. It depicts lineage — the thing the tool
// does — instead of being a generic monogram.
export function Logo({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label="Tableau Lineage"
      className={className}
    >
      <defs>
        <linearGradient id="tl-badge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#22c55e" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#tl-badge)" />
      {/* edges */}
      <g stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.85">
        <path d="M12.5 14.5 L24 20" />
        <path d="M12.5 25.5 L24 20" />
      </g>
      {/* source nodes */}
      <circle cx="12.5" cy="14.5" r="3.4" fill="#ffffff" opacity="0.95" />
      <circle cx="12.5" cy="25.5" r="3.4" fill="#ffffff" opacity="0.95" />
      {/* calculated node (filled ring) */}
      <circle cx="26" cy="20" r="4.6" fill="#ffffff" />
      <circle cx="26" cy="20" r="2.1" fill="#0ea5e9" />
    </svg>
  );
}
