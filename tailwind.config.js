/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand — the sky→green identity from the original tool.
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#38bdf8',
          500: '#0ea5e9', // sky — primary
          600: '#0284c7',
          700: '#0369a1',
        },
        sky: { DEFAULT: '#0ea5e9' },
        leaf: '#22c55e', // green — secondary half of the gradient
        // Field-type semantics (meaningful in the graph; kept stable).
        calc: '#0ea5e9',
        raw: '#22c55e',
        param: '#ec4899',
        lod: '#a21caf',
        ink: '#0f172a',
        muted: '#475569',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        slideInLeft: { from: { opacity: '0', transform: 'translateX(-24px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(24px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        floatUp: { to: { transform: 'translate(var(--float-x, 0), -100vh)', opacity: '0' } },
        glow: {
          '0%, 100%': { boxShadow: '0 0 22px rgba(14,165,233,0.25)' },
          '50%': { boxShadow: '0 0 34px rgba(34,197,94,0.45)' },
        },
        drawEdge: { from: { strokeDashoffset: '100' }, to: { strokeDashoffset: '0' } },
        popNode: { '0%': { opacity: '0', transform: 'scale(0)' }, '70%': { transform: 'scale(1.15)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out both',
        'scale-in': 'scaleIn 0.45s cubic-bezier(0.16,1,0.3,1) both',
        'slide-in-left': 'slideInLeft 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'slide-in-right': 'slideInRight 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both',
        glow: 'glow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
