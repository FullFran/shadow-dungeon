import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONTROLS, buttonHoldProgress, createWake, ringFill, skipKeyGlyph } from '../../src/ui/cinematic-controls-model';
import { SKIP } from '../../src/ui/cinematic';
import es from '../../src/i18n/es.json';
import en from '../../src/i18n/en.json';

const ROOT = join(__dirname, '..', '..');
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|css)$/.test(path) ? [path] : [];
  });
}

describe('hold-to-skip model', () => {
  it('the button needs 0.6 s held, the keys keep their 0.8 s', () => {
    expect(CONTROLS.buttonHoldMs).toBe(600);
    expect(SKIP.holdMs).toBe(800);
    expect(buttonHoldProgress(null, 5000)).toBe(0);
    expect(buttonHoldProgress(1000, 1300)).toBeCloseTo(0.5);
    expect(buttonHoldProgress(1000, 1600)).toBe(1);
    expect(buttonHoldProgress(1000, 9000)).toBe(1);
    expect(buttonHoldProgress(1000, 900)).toBe(0);
  });

  it('the ring fills smoothly, and in whole steps under reduced motion', () => {
    expect(ringFill(0.3, false)).toBeCloseTo(0.3);
    expect(ringFill(0, true)).toBe(0);
    expect(ringFill(1, true)).toBe(1);
    for (const p of [0.01, 0.2, 0.5, 0.77, 0.99]) {
      const steps = ringFill(p, true) * CONTROLS.ringSteps;
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-9);
      expect(ringFill(p, true)).toBeGreaterThanOrEqual(p);
    }
  });
});

describe('quiet at rest', () => {
  it('wakes on any input and falls back after 2 s idle', () => {
    const wake = createWake();
    expect(wake.awake(0)).toBe(false);
    wake.wake(1000);
    expect(wake.awake(1000)).toBe(true);
    expect(wake.awake(2999)).toBe(true);
    expect(wake.awake(3000)).toBe(false);
    wake.wake(5000);
    expect(wake.awake(6500)).toBe(true);
  });

  it('rests between 60% and 70% opacity', () => {
    expect(CONTROLS.restOpacity).toBeGreaterThanOrEqual(0.6);
    expect(CONTROLS.restOpacity).toBeLessThanOrEqual(0.7);
  });
});

describe('device glyph', () => {
  it('Esc on keyboard, B on a pad, hold on touch', () => {
    expect(skipKeyGlyph('keyboard')).toBe('esc');
    expect(skipKeyGlyph('gamepad')).toBe('pad');
    expect(skipKeyGlyph('touch')).toBe('hold');
  });
});

describe('every cinematic mounts the shared controls', () => {
  const player = read('src/app/prologue.ts');

  it('the one player builds them from the shared module', () => {
    expect(player).toMatch(/from '\.\.\/ui\/cinematic-controls'/);
    expect(player).toMatch(/mountCinematicControls\(/);
  });

  it('prologue, guardian, Sima, story, herald and the gallery replay all go through that player', () => {
    const main = read('src/app/main.ts');
    for (const entry of ['prologue', 'guardianCinematic', 'simaScene', 'storyCinematic', 'heraldCinematic', 'galleryCinematic']) {
      const start = main.indexOf(`function ${entry}(`);
      expect(start, entry).toBeGreaterThan(-1);
      const body = main.slice(start, start + 2600);
      expect(body, entry).toContain('prologueScreen(');
    }
  });

  it('nobody else builds a skip or an auto button of their own', () => {
    const offenders = sources(join(ROOT, 'src'))
      .filter((file) => !/cinematic-controls/.test(file))
      .filter((file) => /prologue-skip|prologue-auto|prologue-hint|prologue-hold/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
    expect(read('index.html')).not.toMatch(/prologue-(skip|auto|hold|hint)/);
  });
});

describe('copy', () => {
  it('has the new strings in Spanish and English', () => {
    for (const key of ['prologue.skip', 'cinematic.auto', 'cinematic.skip.hold', 'cinematic.skip.holdKey', 'cinematic.auto.on', 'cinematic.auto.off']) {
      expect((es as Record<string, string>)[key], `es ${key}`).toBeTruthy();
      expect((en as Record<string, string>)[key], `en ${key}`).toBeTruthy();
    }
  });
});
