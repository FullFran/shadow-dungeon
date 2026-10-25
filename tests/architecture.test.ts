import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The simulation core must stay pure: it may import only itself and the
 * typed game data (never the netcode). tsconfig.core.json additionally
 * compiles it without DOM typings, so browser globals fail typecheck.
 * The netcode (src/net) may use the core and the data, never adapters, app, ui or i18n.
 * The UI kit (src/ui) sits with the adapters: neither the core nor the netcode may import it.
 * The balance harness (src/sim: bots, runner, bands) sits on top of the core:
 * it may import only the core, the data and itself, and nothing imports it but tests and tools.
 */
const ROOT = join(__dirname, '..');
const PURE_LAYERS = ['src/core', 'src/data'];
const FORBIDDEN = [/\/adapters\//, /\/app\//, /\/ui\//, /\/i18n\//, /\/net\//, /\/sim\//, /^node:/];
const NET_FORBIDDEN = [/\/adapters\//, /\/app\//, /\/ui\//, /\/i18n\//, /^node:/];

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
    it(`${layer} does not import adapters, app, ui, i18n or node built-ins`, () => {
      const violations = sourceFiles(join(ROOT, layer)).flatMap((file) =>
        importsOf(readFileSync(file, 'utf8'))
          .filter((spec) => FORBIDDEN.some((rule) => rule.test(spec)) || (!spec.startsWith('.') && !spec.startsWith('/')))
          .map((spec) => `${relative(ROOT, file)} -> ${spec}`),
      );
      expect(violations).toEqual([]);
    });
  }

  it('src/net does not import adapters, app, ui, i18n, node built-ins or packages', () => {
    const violations = sourceFiles(join(ROOT, 'src/net')).flatMap((file) =>
      importsOf(readFileSync(file, 'utf8'))
        .filter((spec) => NET_FORBIDDEN.some((rule) => rule.test(spec)) || (!spec.startsWith('.') && !spec.startsWith('/')))
        .map((spec) => `${relative(ROOT, file)} -> ${spec}`),
    );
    expect(violations).toEqual([]);
  });

  it('src/sim imports only the core, the data and itself, and no app layer imports src/sim', () => {
    const allowed = (spec: string) => spec.startsWith('./') || spec.startsWith('../core/') || spec.startsWith('../data/');
    const violations = sourceFiles(join(ROOT, 'src/sim')).flatMap((file) =>
      importsOf(readFileSync(file, 'utf8'))
        .filter((spec) => !allowed(spec))
        .map((spec) => `${relative(ROOT, file)} -> ${spec}`),
    );
    expect(violations).toEqual([]);
    const layers = ['src/core', 'src/data', 'src/net', 'src/adapters', 'src/ui', 'src/app', 'src/i18n', 'src/town', 'src/pwa'].flatMap((dir) => sourceFiles(join(ROOT, dir)));
    const importers = layers.filter((file) => importsOf(readFileSync(file, 'utf8')).some((spec) => /(^|\/)sim\//.test(spec)));
    expect(importers.map((file) => relative(ROOT, file))).toEqual([]);
  });

  it('only the Trystero adapter imports the trystero package, and the app loads it lazily', () => {
    const files = ['src/core', 'src/data', 'src/net', 'src/adapters', 'src/ui', 'src/app'].flatMap((dir) => sourceFiles(join(ROOT, dir)));
    const importers = files.filter((file) => importsOf(readFileSync(file, 'utf8')).some((spec) => spec === 'trystero' || spec.startsWith('trystero/')));
    expect(importers.map((file) => relative(ROOT, file))).toEqual(['src/adapters/trystero.ts']);
    const staticImport = /(?:import|export)[^'"(]*?from\s*['"][^'"]*adapters\/trystero['"]|^import\s+['"][^'"]*adapters\/trystero['"]/m;
    const eager = files.filter((file) => staticImport.test(readFileSync(file, 'utf8'))).map((file) => relative(ROOT, file));
    expect(eager).toEqual([]);
  });
});
