import type { Config } from 'tailwindcss';
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: '#0a0918', ink: '#13112a', veil: '#1e1b4b', mist: '#c7c3e6',
        gold: { DEFAULT: '#d4af37', soft: '#e9d8a6', deep: '#9c7c1c' },
      },
      fontFamily: { display: ['"Cormorant Garamond"', 'Georgia', 'serif'] },
      keyframes: { twinkle: { '0%,100%': { opacity: '0.35' }, '50%': { opacity: '0.9' } } },
      animation: { twinkle: 'twinkle 6s ease-in-out infinite' },
    },
  },
  plugins: [],
} satisfies Config;
