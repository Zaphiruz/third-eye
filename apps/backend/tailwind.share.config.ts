import type { Config } from 'tailwindcss';
import preset from '../../packages/ui/tailwind-preset.js';

export default {
  presets: [preset],
  content: ['../../packages/ui/src/**/*.{ts,tsx}', './src/shares/**/*.tsx'],
  corePlugins: { preflight: true },
} satisfies Config;
