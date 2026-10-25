import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PALETTE as COLORS } from '../../src/ui/tokens';

/** The web app manifest and its icons (installability checks that need no browser). */
const ROOT = join(__dirname, '..', '..');
const manifest = JSON.parse(readFileSync(join(ROOT, 'public', 'manifest.webmanifest'), 'utf8'));

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('web app manifest', () => {
  it('names the game without the franchise name', () => {
    expect(manifest.name).toBe('Mazmorra Sombría');
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    for (const field of ['name', 'short_name', 'description']) expect(manifest[field]).not.toMatch(/pok[eé]mon/i);
  });

  it('starts and scopes relative to its own folder (works under the Pages sub-path)', () => {
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.id).toBe('./');
    for (const icon of manifest.icons) expect(icon.src).not.toMatch(/^\/|^https?:/);
  });

  it('opens full screen in landscape (standalone as the fallback) with the UI colours', () => {
    expect(manifest.display).toBe('fullscreen');
    expect(manifest.display_override).toEqual(['fullscreen', 'standalone']);
    expect(manifest.orientation).toBe('landscape');
    expect(manifest.background_color).toBe(COLORS.ink);
    expect(manifest.theme_color).toBe(COLORS.ink);
  });

  it('has 192 and 512 icons plus a maskable one, and the files match their sizes', () => {
    const bySize = (size: string, purpose: string) => manifest.icons.find((i: { sizes: string; purpose: string }) => i.sizes === size && i.purpose === purpose);
    expect(bySize('192x192', 'any')).toBeTruthy();
    expect(bySize('512x512', 'any')).toBeTruthy();
    expect(bySize('512x512', 'maskable')).toBeTruthy();
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(icon.type).toBe('image/png');
      expect(pngSize(join(ROOT, 'public', icon.src))).toEqual({ width: w, height: h });
    }
  });

  it('is linked from the page with a relative URL, with the theme colour and the iOS icon', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    expect(html).toContain('<link rel="manifest" href="./manifest.webmanifest" />');
    expect(html).toContain(`<meta name="theme-color" content="${COLORS.ink}" />`);
    expect(html).toContain('<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />');
    expect(pngSize(join(ROOT, 'public', 'icons', 'apple-touch-icon.png'))).toEqual({ width: 180, height: 180 });
  });
});
