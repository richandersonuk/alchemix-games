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
      },
      animation: {
        'log-in': 'log-in 0.35s ease-out',
        'pulse-ring': 'pulse-ring 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [
    ({ addVariant }) => {
      addVariant('pointer-coarse', '@media (pointer: coarse)');
    },
  ],
};
