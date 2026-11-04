import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Stamps the service worker with a hash of the art (public/sprites, portraits,
 * tiles, music): their paths and sizes. The art cache is named after it
 * (public/sw.js), so a build that changes only code keeps the player's sprites
 * and a build that changes any art file starts a fresh cache.
 */
export const ART_DIRS = ['sprites', 'portraits', 'tiles', 'music'] as const;
export const ART_PLACEHOLDER = '__ART_VERSION__';

function walk(dir: string, prefix: string, out: string[]): void {
  let names: string[];
  try {
    names = readdirSync(dir).sort();
  } catch {
    return;
  }
  for (const name of names) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, `${prefix}${name}/`, out);
    else out.push(`${prefix}${name}:${stat.size}`);
  }
}

/** A short hash of the art files' paths and sizes under `publicDir`. */
export function artVersion(publicDir: string): string {
  const lines: string[] = [];
  for (const dir of ART_DIRS) walk(join(publicDir, dir), `${dir}/`, lines);
  return createHash('sha1').update(lines.join('\n')).digest('hex').slice(0, 10);
}

export function artVersionPlugin(): Plugin {
  let outDir = 'dist';
  let publicDir = 'public';
  return {
    name: 'art-version',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
      publicDir = config.publicDir || 'public';
    },
    closeBundle() {
      const file = join(outDir, 'sw.js');
      try {
        writeFileSync(file, readFileSync(file, 'utf8').split(ART_PLACEHOLDER).join(artVersion(publicDir)));
      } catch {
        // No service worker in this build: nothing to stamp.
      }
    },
  };
}
