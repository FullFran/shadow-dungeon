import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { artVersionPlugin } from './tools/art-version-plugin';
import { fxFeedbackPlugin } from './tools/fx-feedback-plugin';

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

/**
 * Whether the build may inline an asset as a data URL: never a portrait (issue #47). Each is under Vite's 4 KB limit,
 * so all of them would ride inside index.js and load at start; as files, one loads when a dialogue line shows it.
 * Anything else keeps Vite's default (undefined).
 */
export function inlineAsset(file: string): false | undefined {
  return /[\\/]assets[\\/]portraits[\\/]/.test(file) ? false : undefined;
}

export default defineConfig({
  // Relative base so the build can be served from any sub-path (e.g. GitHub Pages).
  base: './',
  define: buildDefines(process.env, gitHead),
  // The effect bake worker loads each effect on demand (src/adapters/fx/bake.worker.ts).
  worker: { format: 'es' },
  build: { assetsInlineLimit: inlineAsset },
  // Development server only: the effect gallery's verdicts (tools/fx-gallery.html).
  plugins: [fxFeedbackPlugin(), artVersionPlugin()],
});
