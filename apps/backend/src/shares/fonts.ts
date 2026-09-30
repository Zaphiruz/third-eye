import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const FILES = new Map<string, string>([
  ['cormorant-400.woff2', '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2'],
  ['cormorant-600.woff2', '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2'],
]);
const cache = new Map<string, Buffer>();

/** The font bytes for an allow-listed file name, or null. */
export function shareFont(name: string): Buffer | null {
  const spec = FILES.get(name);
  if (!spec) return null;
  let buf = cache.get(name);
  if (!buf) { buf = readFileSync(require.resolve(spec)); cache.set(name, buf); }
  return buf;
}
