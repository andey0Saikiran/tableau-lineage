// A small, looping illustration of what the tool produces: raw fields and a
// parameter flowing into a calculated field, then into a sheet. It shows a
// first-time visitor "what's happening" at a glance. Decorative — animations
// collapse to a static final state under prefers-reduced-motion.
export function HeroGraph({ className = '' }: { className?: string }) {
  return (
    <div className={className} aria-hidden>
      <svg viewBox="0 0 360 150" className="h-auto w-full max-w-md" role="presentation">
        <style>{`
          .tl-edge { stroke-dasharray: 6 6; animation: tlflow 1.4s linear infinite; }
          .tl-edge.e2 { animation-delay: .2s; }
          .tl-edge.e3 { animation-delay: .4s; }
          .tl-edge.e4 { animation-delay: .6s; }
          @keyframes tlflow { to { stroke-dashoffset: -24; } }
          .tl-node { animation: tlpulse 3s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
          .tl-node.n2 { animation-delay: .4s; }
          .tl-node.n3 { animation-delay: .8s; }
          .tl-calc { animation: tlpulse 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
          @keyframes tlpulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
          @media (prefers-reduced-motion: reduce) {
            .tl-edge, .tl-node, .tl-calc { animation: none; }
          }
        `}</style>
        {/* edges */}
        <g fill="none" strokeWidth="2.5" strokeLinecap="round">
          <path className="tl-edge" d="M70 38 L185 72" stroke="#22c55e" />
          <path className="tl-edge e2" d="M70 110 L185 78" stroke="#22c55e" />
          <path className="tl-edge e3" d="M70 74 L185 75" stroke="#ec4899" />
          <path className="tl-edge e4" d="M232 75 L300 75" stroke="#0ea5e9" />
        </g>
        {/* raw fields (circles) */}
        <g>
          <circle className="tl-node" cx="58" cy="38" r="13" fill="#dcfce7" stroke="#22c55e" strokeWidth="2.5" />
          <circle className="tl-node n3" cx="58" cy="110" r="13" fill="#dcfce7" stroke="#22c55e" strokeWidth="2.5" />
        </g>
        {/* parameter (diamond) */}
        <rect className="tl-node n2" x="48" y="64" width="20" height="20" rx="3" transform="rotate(45 58 74)" fill="#fce7f3" stroke="#ec4899" strokeWidth="2.5" />
        {/* calculated field (rounded box) */}
        <rect className="tl-calc" x="186" y="60" width="46" height="30" rx="7" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="2.5" />
        <text x="209" y="79" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0369a1" fontFamily="ui-monospace, monospace">ƒx</text>
        {/* sheet / output */}
        <rect x="300" y="60" width="30" height="30" rx="6" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="2.5" />
        <path d="M306 70 h18 M306 76 h18 M306 82 h12" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}
