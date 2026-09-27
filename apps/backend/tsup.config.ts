import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  noExternal: ['@third-eye/shared', '@third-eye/divination'],
  sourcemap: true,
  clean: true,
});
