import { afterEach, describe, expect, it } from 'vitest';
import { slotCooldown, slotCount } from '../../src/adapters/hud';
import { soundFor, SOUND_IDS } from '../../src/adapters/audio';
import { AURA_FADE_MS, playerVfx } from '../../src/adapters/move-vfx';
import { MOVES } from '../../src/data/moves';
import { setLanguage } from '../../src/i18n';
import { vec } from '../../src/core/vec';
import type { ActionState } from '../../src/core/state';

const base = { items: [], level: 1 } as const;

describe('boost presentation: HUD', () => {
  afterEach(() => setLanguage('es'));

  it('shows the seconds left (rounded up) and the share of the cooldown still to run', () => {
    setLanguage('es');
    const total = MOVES['swords-dance'].cooldownMs!;
    expect(slotCooldown({}, 'swords-dance')).toBeNull();
    expect(slotCooldown({ cooldowns: { 'swords-dance': 2100 } }, 'swords-dance')).toEqual({ label: '3 s', fill: 2100 / total });
    // Moves without a cooldown never show one.
    expect(slotCooldown({ cooldowns: { 'shadow-claw': 500 } }, 'shadow-claw')).toBeNull();
  });

  it('lays out four windows once boost or area hold a move, two otherwise', () => {
    expect(slotCount(['shadow-claw', 'play-rough', null, null])).toBe(2);
    expect(slotCount(['shadow-claw', 'play-rough', 'swords-dance', null])).toBe(4);
  });
});

describe('boost presentation: sound', () => {
  it('a boost is heard when it takes hold, not on the press', () => {
    expect(soundFor({ type: 'moveStarted', moveId: 'swords-dance', slotIndex: 2 })).toBeNull();
    expect(soundFor({ type: 'buffStarted', moveId: 'swords-dance' })).toBe('buff');
    expect(SOUND_IDS).toContain('buff');
  });
});

describe('boost presentation: VFX', () => {
  const casting = (phase: ActionState['phase'], phaseMs: number): ActionState => ({ slotIndex: 2, moveId: 'bulk-up', phase, phaseMs, chargeMs: 0, chargeLevel: 0, aimDir: vec(1, 0), mouseAim: false, hitIds: [] });

  it('bursts out of the user in the move type while it takes hold', () => {
    const early = playerVfx({ ...base, action: casting('active', 0) });
    const late = playerVfx({ ...base, action: casting('recovery', 100) });
    expect(early).toMatchObject([{ kind: 'burst', type: 'fighting' }]);
    const r = (v: ReturnType<typeof playerVfx>) => (v[0]?.kind === 'burst' ? v[0].radius : 0);
    expect(r(late)).toBeGreaterThan(r(early));
  });

  it('keeps an aura while the buff runs, blinking near its end', () => {
    expect(playerVfx({ ...base, action: null, buff: { moveId: 'nasty-plot', remainingMs: 4000 } })).toMatchObject([{ kind: 'aura', type: 'dark', fading: false }]);
    expect(playerVfx({ ...base, action: null, buff: { moveId: 'nasty-plot', remainingMs: AURA_FADE_MS / 2 } })).toMatchObject([{ kind: 'aura', fading: true }]);
    expect(playerVfx({ ...base, action: null })).toEqual([]);
  });
});
