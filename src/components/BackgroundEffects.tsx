import { useEffect, useState, type CSSProperties } from 'react';

const COLORS = ['rgba(14,165,233,0.9)', 'rgba(34,197,94,0.9)', 'rgba(99,102,241,0.8)'];

// Deterministic pseudo-random so SSR/headless and client agree and no Math.random
// flicker. Particles drift upward and fade — the original's ambient motion.
function makeParticles() {
  const seeded = (i: number, m: number) => ((i * 9301 + 49297) % 233280) / 233280 * m;
  return Array.from({ length: 12 }).map((_, i) => ({
    size: 4 + seeded(i + 1, 6),
    duration: 16 + seeded(i + 7, 16),
    delay: seeded(i + 3, 9),
    startX: (i * 8.3 + seeded(i, 6)) % 100,
    endX: (seeded(i + 2, 60) - 30),
  }));
}

export function BackgroundEffects() {
  const [mounted, setMounted] = useState(false);
  const [particles] = useState(makeParticles);

  useEffect(() => {
    const f = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(f);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="absolute h-[420px] w-[420px] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.35) 0%, transparent 70%)', top: '-12%', left: '-6%' }}
      />
      <div
        className="absolute h-[360px] w-[360px] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.32) 0%, transparent 70%)', bottom: '-8%', right: '-6%' }}
      />
      {mounted &&
        particles.map((p, i) => (
          <span
            key={i}
            className="decorative-motion absolute rounded-full will-change-transform"
            style={
              {
                width: `${p.size}px`,
                height: `${p.size}px`,
                left: `${p.startX}%`,
                bottom: '-12px',
                background: `radial-gradient(circle, ${COLORS[i % 3]}, transparent 72%)`,
                boxShadow: `0 0 ${p.size * 2}px ${COLORS[i % 3]}`,
                animation: `floatUp ${p.duration}s linear ${p.delay}s infinite`,
                '--float-x': `${p.endX}px`,
              } as CSSProperties
            }
          />
        ))}
    </div>
  );
}
