import { describe, expect, it } from 'vitest';
import type { ActionState } from '../../src/core/state';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { MOVES } from '../../src/data/moves';
import { PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';
import { SPRITE_KEYS, SPRITES } from '../../src/data/sprites';
import { attackFrame, attackSheet, directionRow, MOVE_ANIMS, playerAnim } from '../../src/adapters/sprite-anim';

const SHOOT_HIT_1 = { durations: [2, 6, 2, 2, 2, 2, 2, 2, 2, 2, 2], hitFrame: 1, returnFrame: 3 };

describe('attack frame spreading', () => {
  it('spreads a sheet whose HitFrame is 0 or 1 over the whole move instead of holding frame 0', () => {
    expect(attackFrame(SHOOT_HIT_1, 'windup', 0)).toBe(0);
    expect(attackFrame(SHOOT_HIT_1, 'windup', 0.9)).toBeGreaterThan(0);
    expect(attackFrame(SHOOT_HIT_1, 'recovery', 0.99)).toBe(SHOOT_HIT_1.durations.length - 1);
  });

  it('can start the windup later in the sheet so a short windup does not race through it', () => {
    const anim = { durations: [4, 2, 6, 1, 1, 2, 2, 2], hitFrame: 5, returnFrame: 7 };
    expect(attackFrame(anim, 'windup', 0)).toBe(0);
    expect(attackFrame(anim, 'windup', 0, 2)).toBe(2);
    expect(attackFrame(anim, 'active', 0, 2)).toBe(5);
  });

  it('never holds a single frame through the windup of a starter move', () => {
    for (const species of PLAYABLE_SPECIES) {
      const sprite = SPRITE_KEYS[SPECIES[species].sprite];
      for (const id of SPECIES[species].movepool) {
        const name = attackSheet(sprite, id);
        const meta = SPRITES.sprites[sprite]!.anims[name]!;
        const from = MOVE_ANIMS[id].windupFrom;
        const frames = new Set([0, 0.3, 0.6, 0.95].map((p) => attackFrame(meta, 'windup', p, from)));
        expect(frames.size, `${species} ${id} (${name})`).toBeGreaterThan(1);
      }
    }
  });
});

describe('attack sheet choice', () => {
  it('never releases a starter move with a sheet that is a copy of Charge', () => {
    for (const species of PLAYABLE_SPECIES) {
      const sprite = SPRITE_KEYS[SPECIES[species].sprite];
      for (const id of SPECIES[species].movepool) {
        const meta = SPRITES.sprites[sprite]!.anims[attackSheet(sprite, id)]!;
        expect(meta.source, `${species} ${id}`).not.toBe('Charge');
      }
    }
  });

  it('turns Zorua round after Feint Attack carries it past the target', () => {
    const player = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), species: 'zorua', loadout: ['feint-attack', 'night-daze'] }).player;
    const action = (phase: ActionState['phase']): ActionState => ({ slotIndex: 0, moveId: 'feint-attack', phase, phaseMs: 10, chargeMs: 0, chargeLevel: 0, aimDir: vec(1, 0), mouseAim: true, hitIds: [] });
    const ctx = { timeMs: 0, sinceHurtMs: Number.POSITIVE_INFINITY, moving: false };
    expect(playerAnim({ ...player, action: action('active') }, ctx).row).toBe(directionRow(vec(1, 0)));
    expect(playerAnim({ ...player, action: action('recovery') }, ctx).row).toBe(directionRow(vec(-1, 0)));
    expect(MOVES['feint-attack'].hitbox.kind).toBe('dash');
  });
});
