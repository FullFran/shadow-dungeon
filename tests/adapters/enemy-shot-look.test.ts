import { describe, expect, it } from 'vitest';
import { MOVES, type MoveDef, type MoveId } from '../../src/data/moves';
import { everyShot } from '../data/enemy-shots';
import { DEFAULT_SHOT_MOVE, FLYING_SHOT_MOVE } from '../../src/data/shot-moves';
import { cueKey, cueRequest, enemyShotCue, enemyShotArt, moveCue, projectileCue } from '../../src/adapters/fx/cues';
import { bakeEffect } from '../../src/adapters/fx/bake';
import { loadEffect } from '../../src/adapters/fx/effects';
import { HELD_SHARE, heldFrames, heldPlacement } from '../../src/adapters/fx/system';
import { enemyShotSize, HELD_SCALE, SHOT_HEIGHT } from '../../src/adapters/fx/director';

/**
 * Issue #67 (S4, S7): an enemy shot is drawn with the very baked effect the
 * player's use of its move plays. A projectile move flies as the player's
 * shot (`projectileCue(move.type, move.id)`); a move without a flight look of
 * its own (a slash, a thrust, a burst) is its own effect drawn at shot size,
 * never the anonymous orb.
 */
const attacks = Object.values(MOVES).filter((m: MoveDef) => m.hitbox.kind !== 'self');

describe('an enemy shot looks like the player\'s move (#67)', () => {
  it('a projectile move: the same cue as the player\'s shot, so the same baked effect', () => {
    const shots = attacks.filter((m) => m.hitbox.kind === 'projectile');
    expect(shots.length).toBeGreaterThan(20);
    for (const m of shots) {
      expect(enemyShotCue(m.id), m.id).toEqual(projectileCue(m.type, m.id));
      expect(cueKey(enemyShotCue(m.id)), m.id).toBe(cueKey(projectileCue(m.type, m.id)));
    }
  });

  it('a move without a flight look: its own effect (the one the player sees), never the plain ball', () => {
    const others = attacks.filter((m) => m.hitbox.kind !== 'projectile');
    expect(others.length).toBeGreaterThan(20);
    const plainBall = (m: MoveDef) => cueKey(projectileCue(m.type));
    for (const m of others) {
      const own = moveCue(m)!;
      expect(cueKey(enemyShotCue(m.id)), m.id).toBe(cueKey(own));
      expect(cueKey(enemyShotCue(m.id)), m.id).not.toBe(plainBall(m));
    }
  });

  it('the look follows the move, not the damage type: a Flying shot drawn as Swift is Swift\'s star', () => {
    expect(enemyShotCue(FLYING_SHOT_MOVE)).toEqual(projectileCue('normal', 'swift'));
    expect(enemyShotCue(DEFAULT_SHOT_MOVE.flying).effect).toBe('pickups/power-star');
  });

  it('the owner\'s examples: an enemy Ember is our Ember, a Lanturn ring Bubble Beam, a Gengar curl Shadow Ball', () => {
    expect(enemyShotCue('ember').effect).toBe('fire/fireball');
    expect(enemyShotCue('bubble-beam').effect).toBe('water/water-orb');
    expect(enemyShotCue('shadow-ball').effect).toBe('arcane/arcane-orb');
  });
});

/** Every move an enemy shot is drawn as, and those of them that are held (S7: their own effect is a swing, blow or burst). */
const USED = [...new Set(everyShot().map((s) => String(s.shot.move)))].sort() as MoveId[];
const HELD_SHOTS = USED.filter((id) => enemyShotArt(id).held);

describe('a move without a flight look is held, not looped (#67, S7)', () => {
  it('held exactly when the move is not a projectile; the cue is the player\'s either way', () => {
    for (const m of attacks) {
      const look = enemyShotArt(m.id);
      expect(look.cue, m.id).toEqual(enemyShotCue(m.id));
      expect(look.held, m.id).toBe(m.hitbox.kind !== 'projectile' && moveCue(m) !== null);
    }
    // The list the feature doc and the GDD give (odd/tasks/enemy-shots-as-moves.md, S7): a new one shows up here first.
    expect(HELD_SHOTS).toEqual(HELD_LIST);
  });

  it('a held shot loops only its full frames: never a blank one, each at least the share of the fullest', async () => {
    for (const id of HELD_SHOTS) {
      const cue = enemyShotCue(id);
      const baked = bakeEffect(await loadEffect(cue.effect), cueRequest(cue));
      const held = heldFrames(baked.frames);
      const area = (i: number) => baked.frames[i]!.w * baked.frames[i]!.h;
      const fullest = Math.max(...baked.frames.map((f) => f.w * f.h));
      expect(held.length, id).toBeGreaterThan(0);
      for (const i of held) expect(area(i), `${id} frame ${i}`).toBeGreaterThanOrEqual(fullest * HELD_SHARE);
      expect(held.length, id).toBe(baked.frames.filter((f) => f.w * f.h >= fullest * HELD_SHARE).length);
    }
  }, 60_000);

  it('a flying look is as tall as the player\'s shot of that size; a held one spans a box HELD_SCALE times that, as its art is sparse', () => {
    expect(enemyShotSize(6, enemyShotArt('ember'))).toBeCloseTo(6 * SHOT_HEIGHT.enemy * (enemyShotCue('ember').shotScale ?? 1));
    expect(enemyShotSize(6, enemyShotArt('night-slash'))).toBeCloseTo(6 * SHOT_HEIGHT.enemy * HELD_SCALE * (enemyShotCue('night-slash').shotScale ?? 1));
    expect(HELD_SCALE).toBeGreaterThan(1);
  });

  it('held art is centred on the shot and its larger side spans the box, at any heading', () => {
    const bounds = { left: -7, right: 100, top: -78, bottom: 16 };
    for (const angle of [0, 1, Math.PI * 0.75, Math.PI, -2]) {
      const at = { x: 50, y: 40 };
      const p = heldPlacement(bounds, at, angle, 30);
      expect(p.scale).toBeCloseTo(30 / 107);
      // The art's middle sits on the anchor's aim line at (left + right) / 2 art pixels: that point must be the shot.
      const middle = ((bounds.left + bounds.right) / 2) * p.scale;
      expect(p.x + Math.cos(angle) * middle).toBeCloseTo(at.x);
      expect(p.y + Math.sin(angle) * middle).toBeCloseTo(at.y);
    }
  });
});

/** The held moves (S7), as listed in the feature doc and the GDD. */
const HELD_LIST = ['bone-rush', 'crunch', 'dark-pulse', 'dazzling-gleam', 'dig', 'dragon-claw', 'earthquake', 'feint-attack', 'focus-punch', 'future-sight', 'ice-fang', 'iron-head', 'metal-claw', 'night-daze', 'night-slash', 'outrage', 'play-rough', 'psycho-cut', 'rock-slide', 'shadow-claw', 'shadow-sneak', 'spark', 'sucker-punch', 'surf', 'thunder', 'thunder-fang', 'thunder-punch', 'x-scissor'];
