import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, TELEGRAPH_FLOOR, type Difficulty } from '../../src/data/difficulty';
import { ENEMY_BEHAVIOUR, ENEMY_SHOT_CAP, type EnemyAttackDef, type EnemyDef } from '../../src/data/enemies';
import { EVOLUTIONS } from '../../src/data/evolutions';
import { EVOLVED_BEHAVIOUR } from '../../src/data/evolved-enemies';
import { PLAYABLE_SPECIES, SPECIES, type SpeciesId } from '../../src/data/species';
import { TUNING } from '../../src/data/tuning';
import { computeDamage } from '../../src/core/damage';
import type { GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { behaviourFor } from '../../src/core/tricks';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { IDLE } from './helpers';

/** A tough, idle player at 400,300 and one enemy, at tier `d`. */
function arena(species: SpeciesId, d: Difficulty, enemyPos: Vec2): WorldState {
  const w = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), difficulty: d });
  return spawnEnemy({ ...w, player: { ...w.player, hp: 1e6, maxHp: 1e6, disguiseBroken: true } }, species, enemyPos);
}

function run(state: WorldState, ms: number, until?: (s: WorldState) => boolean): { state: WorldState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < ms / FIXED_DT_MS && !(until && until(current)); i++) {
    current = step(current, IDLE, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

const attacks = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'enemyAttack' && e.enemyId === 'e1' ? [e.attack] : []));
const telegraphs = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'enemyTelegraph' && e.enemyId === 'e1' ? [e] : []));
const recovering = (s: WorldState) => s.enemies[0]!.ai.mode === 'recover';
const enemyShots = (s: WorldState) => s.projectiles.filter((p) => p.owner === 'enemy');

/** Where each evolution starts its fight (the player at 400,300): inside its engage range. */
const START: Readonly<Record<string, Vec2>> = {
  mightyena: vec(500, 300),
  haunter: vec(580, 300),
  gengar: vec(590, 300),
  dusclops: vec(540, 300),
  bisharp: vec(480, 300),
  breloom: vec(560, 300),
  drifblim: vec(540, 300),
  morgrem: vec(500, 300),
  noctowl: vec(540, 300),
  ariados: vec(560, 300),
  golbat: vec(510, 300),
  kingler: vec(500, 300),
  octillery: vec(590, 300),
  crawdaunt: vec(530, 300),
  arbok: vec(540, 300),
  skuntank: vec(460, 300),
  weezing: vec(460, 300),
  muk: vec(450, 300),
  toxicroak: vec(470, 300),
  houndoom: vec(480, 300),
};

/** Every damaging attack of a behaviour with the wind-up in front of it. */
function attacksOf(def: EnemyDef): { name: string; attack: EnemyAttackDef; telegraphMs: number }[] {
  switch (def.kind) {
    case 'lunger':
      return [
        { name: 'lunge', attack: def.attack, telegraphMs: def.telegraphMs },
        ...(def.followUp ? [{ name: 'lunge2', attack: def.attack, telegraphMs: def.followUp.telegraphMs }] : []),
        ...(def.thirdCut ? [{ name: 'lunge3', attack: def.attack, telegraphMs: def.thirdCut.telegraphMs }] : []),
        ...(def.feint ? [{ name: 'feinted', attack: def.attack, telegraphMs: def.feint.telegraphMs }] : []),
      ];
    case 'caster':
      return [{ name: 'ball', attack: def.projectile, telegraphMs: def.telegraphMs }];
    case 'slammer':
      return [
        { name: 'slam', attack: def.attack, telegraphMs: def.telegraphMs },
        ...(def.ring ? [{ name: 'ring', attack: def.ring.projectile, telegraphMs: def.telegraphMs }] : []),
        ...(def.hardRing ? [{ name: 'hardRing', attack: def.hardRing.projectile, telegraphMs: def.telegraphMs }] : []),
        ...(def.puddle ? [{ name: 'puddle', attack: def.puddle, telegraphMs: def.telegraphMs }] : []),
      ];
    case 'beam':
    case 'pulse':
    case 'cone':
      return [
        { name: def.kind, attack: def.attack, telegraphMs: def.telegraphMs },
        ...('repeat' in def && def.repeat ? [{ name: 'repeat', attack: def.attack, telegraphMs: def.repeat.telegraphMs }] : []),
      ];
    case 'bomber':
      return [
        { name: 'puff', attack: def.cloud, telegraphMs: def.telegraphMs },
        { name: 'explode', attack: def.explode.attack, telegraphMs: def.explode.telegraphMs },
      ];
    case 'counter':
      return [
        { name: 'counter', attack: def.counter.attack, telegraphMs: def.counter.telegraphMs },
        { name: 'jab', attack: def.jab.attack, telegraphMs: def.jab.telegraphMs },
        ...(def.repeat ? [{ name: 'jab2', attack: def.jab.attack, telegraphMs: def.repeat.telegraphMs }] : []),
      ];
    default:
      return [];
  }
}

const RANK: Readonly<Record<Difficulty, number>> = { easy: 0, normal: 1, hard: 2, nightmare: 3 };
const GROWS = ['count', 'waves', 'times', 'shots', 'radius', 'reach', 'length', 'lungeDistance', 'distance', 'arcDegrees'];

/** What an evolution adds over its base form: a new move (a field the base lacks, or a tier-gated one played earlier) or a bigger pattern. */
function escalation(def: EnemyDef, base: EnemyDef): { move: boolean; bigger: boolean } {
  const a = def as unknown as Record<string, unknown>;
  const b = base as unknown as Record<string, unknown>;
  let move = Object.keys(b).includes('followUpFrom') && !('followUpFrom' in a);
  let bigger = false;
  for (const [key, value] of Object.entries(a)) {
    if (!(key in b)) {
      if (key !== 'followUpFrom') move = true;
      continue;
    }
    const was = b[key];
    if (typeof value === 'number' && typeof was === 'number' && GROWS.includes(key) && value > was) bigger = true;
    if (value && was && typeof value === 'object' && typeof was === 'object') {
      const v = value as Record<string, unknown>;
      const w = was as Record<string, unknown>;
      if (typeof v.minDifficulty === 'string' && typeof w.minDifficulty === 'string' && RANK[v.minDifficulty as Difficulty] < RANK[w.minDifficulty as Difficulty]) move = true;
      for (const k of GROWS) if (typeof v[k] === 'number' && (typeof w[k] !== 'number' || (v[k] as number) > (w[k] as number))) bigger = true;
    }
  }
  return { move, bigger };
}

describe('evolved forms: behaviour data', () => {
  it('every evolution has a behaviour, exported in the enemy table', () => {
    for (const { species } of EVOLUTIONS) {
      expect(EVOLVED_BEHAVIOUR[species], species).toBeDefined();
      expect(ENEMY_BEHAVIOUR[species]).toBe(EVOLVED_BEHAVIOUR[species]);
    }
  });

  for (const { species, from } of EVOLUTIONS) {
    it(`${species}: fights like ${from} (same kind), with more poise, and escalates it`, () => {
      const def = EVOLVED_BEHAVIOUR[species]!;
      const base = ENEMY_BEHAVIOUR[from]!;
      expect(def.kind).toBe(base.kind);
      expect(def.poise.hitstunScale).toBeLessThanOrEqual(base.poise.hitstunScale);
      expect(def.poise.knockbackScale).toBeLessThanOrEqual(base.poise.knockbackScale);
      const { move, bigger } = escalation(def, base);
      expect(move || bigger, `${species} adds nothing over ${from}`).toBe(true);
    });
  }

  it('most evolutions bring an extra move, not only bigger numbers', () => {
    const moves = EVOLUTIONS.filter(({ species, from }) => escalation(EVOLVED_BEHAVIOUR[species]!, ENEMY_BEHAVIOUR[from]!).move);
    // Drifblim, Morgrem and Weezing escalate by count and size (a second ring, a second feint, a wider blast).
    expect(moves.length).toBeGreaterThanOrEqual(EVOLUTIONS.length - 3);
  });
});

describe('evolved forms: fairness of every new attack', () => {
  for (const { species } of EVOLUTIONS) {
    it(`${species}: on every tier, no hit above the roster share of a starter's HP, no damaging wind-up under the readable floor`, () => {
      for (const d of DIFFICULTIES) {
        const def = behaviourFor(species, d)!;
        for (const { name, attack, telegraphMs } of attacksOf(def)) {
          for (const playable of PLAYABLE_SPECIES) {
            const target = SPECIES[playable];
            const { damage } = computeDamage({ power: attack.power, moveType: attack.type, attackerTypes: SPECIES[species].types, defenderTypes: target.types });
            expect(damage / target.maxHp, `${species} ${name} vs ${playable} (${d})`).toBeLessThanOrEqual(TUNING.roster.maxHitShare);
          }
          // Chained wind-ups (a second cut, a repeat) may be shorter than an opener, never under the tier floor.
          expect(telegraphMs, `${species} ${name} (${d})`).toBeGreaterThanOrEqual(name === 'lunge' || name === 'ball' || name === 'slam' || name === 'puff' ? TUNING.roster.minTelegraphMs : TELEGRAPH_FLOOR.minMs);
        }
      }
    });

    it(`${species}: on nightmare every wind-up it plays lasts at least the telegraph floor, and it strikes`, () => {
      const played = run(arena(species, 'nightmare', START[species]!), 9000);
      const winds = telegraphs(played.events);
      expect(winds.length, species).toBeGreaterThan(0);
      for (const t of winds) expect(t.durationMs, `${species} ${t.attack}`).toBeGreaterThanOrEqual(TELEGRAPH_FLOOR.minMs);
      // A strike, or a hit from what it left on the ground (a bomber's puff is no attack event).
      expect(attacks(played.events).length + played.events.filter((e) => e.type === 'playerHurt').length, species).toBeGreaterThan(0);
      expect(enemyShots(played.state).length).toBeLessThanOrEqual(ENEMY_SHOT_CAP);
    });
  }
});

describe('evolved forms: what each one adds, played out', () => {
  it('Mightyena: a second, re-aimed bite on every tier', () => {
    expect(attacks(run(arena('mightyena', 'easy', START.mightyena!), 4000, recovering).events)).toEqual(['lunge', 'lunge2']);
  });

  it('Bisharp: the three cuts Pawniard keeps for hard, from easy', () => {
    expect(attacks(run(arena('bisharp', 'easy', START.bisharp!), 4000, recovering).events)).toEqual(['lunge', 'lunge2', 'lunge3']);
  });

  it('Morgrem: two feints, then the real lunge', () => {
    expect(attacks(run(arena('morgrem', 'easy', START.morgrem!), 6000, recovering).events)).toEqual(['feint', 'feint', 'lunge']);
  });

  it('Gengar: a ring of shadow and an aimed ball in one cast', () => {
    const played = run(arena('gengar', 'easy', START.gengar!), 5000, recovering);
    expect(enemyShots(played.state)).toHaveLength(EVOLVED_BEHAVIOUR.gengar!.kind === 'caster' ? EVOLVED_BEHAVIOUR.gengar!.ring!.count + 1 : 0);
  });

  it('Haunter: two balls per cast on every tier, a fan of three on hard', () => {
    expect(enemyShots(run(arena('haunter', 'easy', START.haunter!), 5000, recovering).state)).toHaveLength(2);
    expect(enemyShots(run(arena('haunter', 'hard', START.haunter!), 5000, recovering).state)).toHaveLength(4);
  });

  it('Dusclops: twin homing wisps, three on hard', () => {
    expect(enemyShots(run(arena('dusclops', 'easy', START.dusclops!), 5000, recovering).state)).toHaveLength(2);
    expect(enemyShots(run(arena('dusclops', 'hard', START.dusclops!), 5000, recovering).state)).toHaveLength(3);
  });

  it('Drifblim: two rings of ten per cast, three on hard (forest trick)', () => {
    expect(enemyShots(run(arena('drifblim', 'easy', START.drifblim!), 5000, recovering).state)).toHaveLength(20);
    expect(enemyShots(run(arena('drifblim', 'hard', START.drifblim!), 5000, recovering).state)).toHaveLength(30);
  });

  it('Octillery: a five-shot Octazooka down the locked lane; on hard it opens with a fan of three', () => {
    expect(enemyShots(run(arena('octillery', 'easy', START.octillery!), 5000, recovering).state)).toHaveLength(5);
    expect(enemyShots(run(arena('octillery', 'hard', START.octillery!), 5000, recovering).state)).toHaveLength(7);
  });

  it('Crawdaunt: the jet twice on every tier, three times on hard (caves trick)', () => {
    expect(attacks(run(arena('crawdaunt', 'easy', START.crawdaunt!), 6000, recovering).events)).toEqual(['jet', 'jet']);
    expect(attacks(run(arena('crawdaunt', 'hard', START.crawdaunt!), 6000, recovering).events)).toEqual(['jet', 'jet', 'jet']);
  });

  it('Toxicroak: the Poison Jab chained once on every tier', () => {
    const played = run(arena('toxicroak', 'easy', START.toxicroak!), 6000, recovering);
    expect(attacks(played.events).filter((a) => a === 'jab')).toHaveLength(2);
  });

  it('Arbok: a poison puddle where the lunge ends, on every tier', () => {
    const played = run(arena('arbok', 'easy', START.arbok!), 5000, recovering);
    expect(enemyShots(played.state).some((p) => p.vel.x === 0 && p.vel.y === 0)).toBe(true);
  });

  it('Breloom: the leap throws spores on landing', () => {
    expect(enemyShots(run(arena('breloom', 'easy', START.breloom!), 5000, recovering).state).length).toBeGreaterThan(0);
  });

  it('easy plays the data as written; a few have one more trick from hard', () => {
    for (const { species } of EVOLUTIONS) expect(behaviourFor(species, 'easy')).toBe(EVOLVED_BEHAVIOUR[species]);
    const tricked = EVOLUTIONS.filter(({ species }) => behaviourFor(species, 'hard') !== EVOLVED_BEHAVIOUR[species]).map((e) => e.species);
    expect(tricked.length).toBeGreaterThanOrEqual(5);
  });
});
