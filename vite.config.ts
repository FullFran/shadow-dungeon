import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

/** The single version source: package.json `version` (docs/release.md). */
const packageVersion = (): string => (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version;

/** The short commit of the build: CI's GITHUB_SHA, else the local git HEAD, else "dev". */
export function shortCommit(env: Record<string, string | undefined>, git: () => string): string {
  if (env.GITHUB_SHA) return env.GITHUB_SHA.slice(0, 7);
  try {
    return git().trim().slice(0, 7) || 'dev';
  } catch {
    return 'dev';
  }
}

/** Build-time constants read by src/app/build-info.ts. */
export function buildDefines(env: Record<string, string | undefined>, git: () => string): Record<string, string> {
  return { __APP_VERSION__: JSON.stringify(packageVersion()), __APP_BUILD__: JSON.stringify(shortCommit(env, git)) };
}

const gitHead = () => execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();

export default defineConfig({
  // Relative base so the build can be served from any sub-path (e.g. GitHub Pages).
  base: './',
  define: buildDefines(process.env, gitHead),
});
