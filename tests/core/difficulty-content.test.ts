import { describe, expect, it } from 'vitest';
import { scaledTelegraphMs, TELEGRAPH_FLOOR, type Difficulty } from '../../src/data/difficulty';
import {
  AEGISLASH,
  CHINCHOU,
  CORPHISH,
  CROAGUNK,
  EKANS,
  GASTLY,
  GOLETT,
  HOUNDOUR,
  PAWNIARD,
  POOCHYENA,
  SABLEYE,
  SLUGMA,
  ZUBAT,
  DUSKULL,
} from '../../src/data/enemies';
import { bladeCombo, midnightAttack, phase2Cards, updateBoss } from '../../src/core/boss';
import { tickAiAt } from '../../src/core/difficulty';
import { gemRings, glintBlinks } from '../../src/core/thief';
import { pierceZone } from '../../src/core/victim';
import type { EnemyState, GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { catalog, LANGUAGES } from '../../src/i18n';
import { IDLE } from './helpers';

/** A tough, idle player and one enemy, at tier `d`. */
function arena(species: EnemyState['species'], d: Difficulty | undefined, enemyPos: Vec2, playerPos = vec(400, 300), size = { width: 800, height: 600 }): WorldState {
  const w = createWorld({ seed: 1, arena: size, playerPos, ...(d ? { difficulty: d } : {}) });
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

const attacks = (events: GameEvent[], id = 'e1') => events.flatMap((e) => (e.type === 'enemyAttack' && e.enemyId === id ? [e.attack] : []));
const telegraphsOf = (events: GameEvent[], id = 'e1') => events.flatMap((e) => (e.type === 'enemyTelegraph' && e.enemyId === id ? [e] : []));
const shotsSpawned = (before: WorldState, after: WorldState) => after.projectiles.filter((p) => p.owner === 'enemy' && !before.projectiles.some((q) => q.id === p.id)).length;

/** Until the first enemy recovers after attacking (the punish window). */
const recovering = (s: WorldState) => s.enemies[0]!.ai.mode === 'recover';

describe('hard+ content: the Crypt', () => {
  it('Aegislash: hard adds a fourth Blade blow behind a delayed feint (a longer, readable wind-up), then the opening', () => {
    expect(bladeCombo(AEGISLASH, 'easy')).toHaveLength(3);
    const hard = bladeCombo(AEGISLASH, 'hard');
    expect(hard).toHaveLength(4);
    const feint = hard[3]!;
    expect(feint.telegraphMs).toBeGreaterThan(Math.max(...AEGISLASH.blade.combo.map((b) => b.telegraphMs)));
    const blade = (d: Difficulty) => {
      // Normal and harder fight with spell cards (data/aegislash-cards.ts); the stance duel's tier content now plays in a Sima echo.
      const w = arena('aegislash', d, vec(400, 240));
      const boss = w.enemies[0]!;
      return { ...w, enemyScale: { hp: 1, damage: 1, echo: true as const }, enemies: [{ ...boss, boss: { ...boss.boss!, stance: 'blade' as const }, ai: { ...boss.ai, mode: 'approach' as const } }] };
    };
    const easy = run(blade('easy'), 4000, recovering);
    expect(attacks(easy.events)).toEqual(['combo1', 'combo2', 'combo3']);
    const hardRun = run(blade('hard'), 5000, recovering);
    expect(attacks(hardRun.events)).toEqual(['combo1', 'combo2', 'combo3', 'combo4']);
    expect(recovering(hardRun.state)).toBe(true);
    const wound = telegraphsOf(hardRun.events).find((e) => e.attack === 'combo4')!;
    expect(wound.durationMs).toBe(feint.telegraphMs);
  });

  it('Aegislash: the duel data adds Judgement to phase 2 on nightmare (two shadow walls from opposite ends, each with a gap), positional like Shadow', () => {
    expect(phase2Cards(AEGISLASH, 'hard')).toEqual(['midnight', 'oaths', 'shadow']);
    expect(phase2Cards(AEGISLASH, 'nightmare')).toEqual(['midnight', 'oaths', 'shadow', 'judgement']);
    // Nightmare's Aegislash now fights with spell cards (its own Juicio del Rey card); the duel's walls are driven through its state machine directly.
    const throne = { width: 640, height: 480 };
    const w = arena('aegislash', 'nightmare', vec(320, 240), vec(320, 400), throne);
    const boss = w.enemies[0]!;
    const ready: WorldState = { ...w, enemies: [{ ...boss, hp: boss.maxHp * 0.3, boss: { ...boss.boss!, phase: 2, stance: 'blade', combosDone: 1, cardsPlayed: 3 }, ai: { ...boss.ai, mode: 'approach' } }] };
    let current = ready;
    const events: GameEvent[] = [];
    for (let i = 0; i < 6000 / FIXED_DT_MS && !recovering(current); i++) {
      const e = current.enemies[0]!;
      current = updateBoss(current, { ...e, ai: tickAiAt(e.ai, FIXED_DT_MS, 'nightmare') }, AEGISLASH, current.player.pos, FIXED_DT_MS, events);
    }
    const played = { state: current, events };
    const winds = telegraphsOf(played.events);
    expect(winds.map((e) => e.attack)).toEqual(['judgement', 'judgement2']);
    expect(winds.every((e) => e.pierceRoll === true && e.durationMs >= TELEGRAPH_FLOOR.minMs)).toBe(true);
    expect(attacks(played.events)).toEqual(['judgement', 'judgement']);
    const swords = played.state.projectiles.filter((p) => p.owner === 'enemy');
    expect(swords.every((p) => p.pierceRoll)).toBe(true);
    expect(new Set(swords.map((p) => Math.sign(p.vel.y))).size).toBe(2);
    expect(recovering(played.state)).toBe(true);
  });

  it('Aegislash: the shadow wall is positional on every tier; Midnight only from hard', () => {
    expect(AEGISLASH.phase2.shadow.sword.pierceRoll).toBe(true);
    expect(midnightAttack(AEGISLASH, 'normal').pierceRoll).toBeUndefined();
    expect(midnightAttack(AEGISLASH, 'hard').pierceRoll).toBe(true);
  });

  it('Sableye: a positional gem burst on every tier (rolling does not help, stepping out does), a fourth ring on hard, a fourth Glint on nightmare', () => {
    expect(gemRings(SABLEYE, 'easy')).toBe(3);
    expect(gemRings(SABLEYE, 'hard')).toBe(4);
    expect(glintBlinks(SABLEYE, 'hard')).toBe(3);
    expect(glintBlinks(SABLEYE, 'nightmare')).toBe(4);
    const windingAt = (playerPos: Vec2): WorldState => {
      const w = arena('sableye', 'easy', vec(400, 300), playerPos);
      const s = w.enemies[0]!;
      const rolling = { elapsedMs: 60, dir: vec(1, 0) };
      return {
        ...w,
        player: { ...w.player, roll: rolling },
        enemies: [{ ...s, boss: { ...s.boss!, stance: 'gems' }, ai: { ...s.ai, mode: 'telegraph', modeMs: SABLEYE.gems.telegraphMs - 1, modeDurationMs: SABLEYE.gems.telegraphMs, attack: 'gems' } }],
      };
    };
    expect(pierceZone(windingAt(vec(430, 300)).enemies[0]!, 'easy')).toEqual({ kind: 'circle', radius: SABLEYE.gems.burst.radius });
    const near = run(windingAt(vec(430, 300)), 60);
    expect(near.events.some((e) => e.type === 'playerHurt')).toBe(true);
    const far = run(windingAt(vec(400 + SABLEYE.gems.burst.radius + 40, 300)), 60);
    expect(far.events.some((e) => e.type === 'playerHurt')).toBe(false);
  });

  it('Pawniard: a third cut on hard; Poochyena: a pack howl that readies its packmates (an opening in itself)', () => {
    const cuts = (d: Difficulty) => attacks(run(arena('pawniard', d, vec(400, 230)), 3000, recovering).events);
    expect(cuts('easy')).toEqual(['lunge', 'lunge2']);
    expect(cuts('hard')).toEqual(['lunge', 'lunge2', 'lunge3']);
    expect(PAWNIARD.thirdCut!.telegraphMs).toBeGreaterThanOrEqual(TELEGRAPH_FLOOR.minMs);

    const pack = (d: Difficulty) => {
      const one = arena('poochyena', d, vec(400, 200));
      const two = spawnEnemy(one, 'poochyena', vec(460, 200));
      const mates = { ...two, enemies: two.enemies.map((e) => ({ ...e, ai: { ...e.ai, cooldownMs: 0 } })) };
      return run(mates, 200);
    };
    expect(telegraphsOf(pack('easy').events).some((e) => e.attack === 'howl')).toBe(false);
    const howled = pack('hard');
    expect(telegraphsOf(howled.events).some((e) => e.attack === 'howl')).toBe(true);
    // A lone Poochyena never howls.
    expect(telegraphsOf(run(arena('poochyena', 'hard', vec(400, 200)), 200).events).some((e) => e.attack === 'howl')).toBe(false);
    expect(POOCHYENA.howl!.telegraphMs).toBeGreaterThanOrEqual(TELEGRAPH_FLOOR.minMs);
  });

  it('Duskull: twin wisps on hard; Gastly: a second ball on hard; Golett: rubble thrown all around with the slam on hard', () => {
    const firstCast = (species: EnemyState['species'], d: Difficulty, pos: Vec2) => {
      const start = arena(species, d, pos);
      const after = run(start, 4000, (s) => s.enemies[0]!.ai.mode === 'recover');
      return shotsSpawned(start, after.state);
    };
    expect(firstCast('duskull', 'easy', vec(400, 160))).toBe(1);
    expect(firstCast('duskull', 'hard', vec(400, 160))).toBe(DUSKULL.hardSpread!.count);
    expect(firstCast('gastly', 'easy', vec(400, 130))).toBe(1);
    expect(firstCast('gastly', 'hard', vec(400, 130))).toBe(2);
    expect(GASTLY.secondBall!.delayMs).toBeLessThan(GASTLY.castMs);
    expect(firstCast('golett', 'easy', vec(400, 230))).toBe(0);
    expect(firstCast('golett', 'hard', vec(400, 230))).toBe(GOLETT.hardRing!.count);
  });
});

describe('hard+ content: the roster (Sima)', () => {
  it('Zubat swoops twice, Ekans leaves poison where its lunge ends', () => {
    const swoops = (d: Difficulty) => attacks(run(arena('zubat', d, vec(400, 200)), 4000, recovering).events);
    expect(swoops('easy')).toEqual(['lunge']);
    expect(swoops('hard')).toEqual(['lunge', 'lunge2']);
    const ekans = (d: Difficulty) => {
      const start = arena('ekans', d, vec(400, 180));
      return shotsSpawned(start, run(start, 4000, recovering).state);
    };
    expect(ekans('easy')).toBe(0);
    expect(ekans('hard')).toBe(1);
  });

  it('Corphish jets twice, Chinchou pulses twice, Slugma lobs twice, Croagunk jabs twice: each after a re-aimed wind-up, then the recovery', () => {
    const chain = (species: EnemyState['species'], d: Difficulty, pos: Vec2) => attacks(run(arena(species, d, pos), 8000, recovering).events);
    expect(chain('corphish', 'easy', vec(400, 160))).toEqual(['jet']);
    expect(chain('corphish', 'hard', vec(400, 160))).toEqual(['jet', 'jet']);
    expect(chain('chinchou', 'easy', vec(400, 210))).toEqual(['pulse']);
    expect(chain('chinchou', 'hard', vec(400, 210))).toEqual(['pulse', 'pulse']);
    expect(chain('slugma', 'easy', vec(400, 150))).toEqual(['lob']);
    expect(chain('slugma', 'hard', vec(400, 150))).toEqual(['lob', 'lob']);
    expect(chain('croagunk', 'easy', vec(400, 250))).toEqual(['jab']);
    expect(chain('croagunk', 'hard', vec(400, 250))).toEqual(['jab', 'jab']);
    for (const def of [CORPHISH, CHINCHOU, SLUGMA, CROAGUNK]) expect(def.repeat!.telegraphMs).toBeGreaterThanOrEqual(TELEGRAPH_FLOOR.minMs);
  });

  it('Houndour: on hard the flamethrower turns after the player while it breathes', () => {
    const breathe = (d: Difficulty) => {
      const start = arena('houndour', d, vec(400, 230), vec(400, 300));
      // Mid-breath, the player steps to the side.
      const mid = run(start, 3000, (s) => s.enemies[0]!.ai.mode === 'attack').state;
      const moved = { ...mid, player: { ...mid.player, pos: vec(470, 260) } };
      const later = run(moved, HOUNDOUR.breathMs - 60).state;
      return Math.abs(later.enemies[0]!.ai.attackDir.x - mid.enemies[0]!.ai.attackDir.x);
    };
    expect(breathe('easy')).toBe(0);
    expect(breathe('hard')).toBeGreaterThan(0.1);
  });

  it('at least six roster species have a hard+ variant, and every wind-up still respects the readable floor once scaled', () => {
    const variants = [ZUBAT.followUpFrom, EKANS.landingHazard, CORPHISH.repeat, CHINCHOU.repeat, HOUNDOUR.sweep, SLUGMA.repeat, CROAGUNK.repeat].filter(Boolean);
    expect(variants.length).toBeGreaterThanOrEqual(6);
    const added = [ZUBAT.followUp!.telegraphMs, PAWNIARD.thirdCut!.telegraphMs, POOCHYENA.howl!.telegraphMs, AEGISLASH.blade.extraBlows[0]!.telegraphMs, AEGISLASH.phase2.judgement.telegraphMs, AEGISLASH.phase2.judgement.secondTelegraphMs];
    for (const ms of added) expect(scaledTelegraphMs(ms, 'nightmare')).toBeGreaterThanOrEqual(TELEGRAPH_FLOOR.minMs);
  });

  it('names Judgement in every language', () => {
    for (const language of LANGUAGES) {
      expect(catalog(language)['spell.aegislash.judgement']).toBeTruthy();
      expect(catalog(language)['boss.stance.judgement']).toBeTruthy();
    }
  });
});
