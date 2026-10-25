import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The simulation core must stay pure: it may import only itself and the
 * typed game data. tsconfig.core.json additionally compiles it without DOM
 * typings, so browser globals fail typecheck.
 */
const ROOT = join(__dirname, '..');
const PURE_LAYERS = ['src/core', 'src/data'];
const FORBIDDEN = [/\/adapters\//, /\/app\//, /\/i18n\//, /^node:/];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

function importsOf(source: string): string[] {
  const pattern = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
  return [...source.matchAll(pattern)].map((m) => m[1] ?? m[2] ?? '');
}

describe('architecture', () => {
  for (const layer of PURE_LAYERS) {
    it(`${layer} does not import adapters, app, i18n or node built-ins`, () => {
      const violations = sourceFiles(join(ROOT, layer)).flatMap((file) =>
        importsOf(readFileSync(file, 'utf8'))
          .filter((spec) => FORBIDDEN.some((rule) => rule.test(spec)) || (!spec.startsWith('.') && !spec.startsWith('/')))
          .map((spec) => `${relative(ROOT, file)} -> ${spec}`),
      );
      expect(violations).toEqual([]);
    });
  }
});
