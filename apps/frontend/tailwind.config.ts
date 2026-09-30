import type { Config } from 'tailwindcss';
import preset from '../../packages/ui/tailwind-preset';

export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  plugins: [],
} satisfies Config;
