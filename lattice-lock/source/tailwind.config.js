/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: { short: { raw: '(max-height: 520px)' } },
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        void: '#05070d',
      },
      keyframes: {
        'log-in': { '0%': { opacity: '0', transform: 'translateX(12px)' }, '100%': { opacity: '1', transform: 'none' } },
        'pulse-ring': { '0%,100%': { boxShadow: '0 0 0 0 rgba(34,211,238,0.5)' }, '50%': { boxShadow: '0 0 0 6px rgba(34,211,238,0)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
        'banner-in': { '0%': { opacity: '0', transform: 'scale(0.85) translateY(-10px)' }, '60%': { opacity: '1', transform: 'scale(1.03)' }, '100%': { transform: 'scale(1)' } },
        'banner-shine': { '0%': { left: '-50%' }, '100%': { left: '150%' } },
      },
      animation: {
        'log-in': 'log-in 0.35s ease-out',
        'pulse-ring': 'pulse-ring 1.6s ease-in-out infinite',
        'banner-in': 'banner-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
        'banner-shine': 'banner-shine 1.4s ease-in-out 0.3s both',
      },
    },
  },
  plugins: [
    ({ addVariant }) => {
      addVariant('pointer-coarse', '@media (pointer: coarse)');
    },
  ],
};
