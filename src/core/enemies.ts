import { ENEMY_BEHAVIOUR, type GastlyDef, type PoochyenaDef, type SlammerDef, type SporeDef } from '../data/enemies';
import { updateArcher } from './archer';
import { tickAiAt, worldDifficulty } from './difficulty';
import { atLeast } from '../data/difficulty';
import { updateBoss } from './boss';
import { unstoppable, updateRoster } from './roster';
import { updateThief } from './thief';
import { contactPlayer, enterMode, modeOver, moveEnemy, pathDirection, perpendicular, replaceEnemy, spawnShot, spreadDirections, telegraph, towardTarget } from './brain';
import { targetOf } from './party';
import { lungeTouches, slammerTouches } from './victim';
import type { AiMode, AiState, EnemyState, GameEvent, WorldState } from './state';
import { enemyTimeScale } from './time';
import { add, distance, normalize, scale, vec, type Vec2 } from './vec';

/**
 * Enemy behaviour as explicit state machines (docs/gdd.md §4). Each brain
 * reads the world and returns it with its enemy updated; enemies act only
 * while not staggered and run at the enemy time scale (perfect-dodge slow-mo).
 */
export function initialAi(dormant = false): AiState {
  return {
    mode: dormant ? 'dormant' : 'idle',
    modeMs: 0,
    modeDurationMs: 0,
    attackDir: vec(0, 1),
    contact: 'none',
    cooldownMs: 0,
    strafeSign: 1,
  };
}

/**
 * Lungers (Poochyena, Phantump, Pumpkaboo Small, Hoothoot, Pawniard): stalk,
 * telegraph with Charge, lunge in a straight line; a dodged lunge leaves them
 * exposed. Fliers and phasers (`floats`) cross walls; Phantump drains on a
 * hit; Pawniard chains a short, re-aimed second cut (`followUp`).
 */
function updateLunger(state: WorldState, start: EnemyState, def: PoochyenaDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const ai = enemy.ai;

  const tier = worldDifficulty(state);
  // Harder tiers: Zubat's second swoop, Pawniard's third cut (data `followUpFrom`, `thirdCut`).
  const chains = def.followUp !== undefined && (!def.followUpFrom || atLeast(tier, def.followUpFrom));
  const third = def.thirdCut && chains && atLeast(tier, def.thirdCut.minDifficulty) ? def.thirdCut : null;
  const cut = ai.chain ?? 0;
  const cutDef = cut === 2 && third ? third : cut === 1 && chains ? def.followUp! : { lungeMs: def.lungeMs, lungeDistance: def.lungeDistance };
  const cutName = cut === 2 ? 'lunge3' : cut === 1 ? 'lunge2' : 'lunge';

  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) {
        enemy = { ...enemy, ai: enterMode(ai, 'approach') };
        // Harder tiers (Poochyena): with a packmate near it howls first (harmless: an opening), and the pack lunges at once.
        if (def.howl && atLeast(tier, def.howl.minDifficulty) && packmates(state, enemy, def.howl.range).length > 0) {
          enemy = telegraph(enemy, 'howl', def.howl.telegraphMs, toPlayer, events);
        }
      }
      break;
    case 'approach': {
      const path = pathDirection(state, enemy, target, def.floats === true);
      if (path) {
        // Out of sight: follow the flow field around the walls, no stalking or lunging.
        enemy = { ...moveEnemy(state, enemy, scale(path, (def.walkSpeed * ms) / 1000)), facing: path };
        break;
      }
      if (ai.cooldownMs <= 0 && dist <= def.lungeRange) {
        enemy = telegraph(enemy, 'lunge', def.telegraphMs, toPlayer, events);
        break;
      }
      // Only while recharging: with the lunge ready it closes in to lunge range (it used to hover at the stalk ring).
      const stalking = ai.cooldownMs > 0 && dist <= def.stalkRange;
      // Circle the player while the lunge recharges, otherwise close in.
      const straight = stalking ? normalize(add(perpendicular(toPlayer, ai.strafeSign), scale(toPlayer, -0.2))) : toPlayer;
      // Erratic fliers (Zubat) sway sideways on the way in.
      const sway = def.weave ? def.weave.amplitude * Math.sin((2 * Math.PI * state.timeMs) / def.weave.periodMs) : 0;
      const dir = sway === 0 ? straight : normalize(add(straight, scale(perpendicular(toPlayer, 1), sway)));
      const speed = def.walkSpeed * (stalking ? 0.6 : 1);
      enemy = { ...moveEnemy(state, enemy, scale(dir, (speed * ms) / 1000)), facing: toPlayer };
      break;
    }
    case 'telegraph':
      // Tracks the player during the wind-up; the direction is committed when it fires (or `lockMs` before: Ekans' coil).
      if (!def.lockMs || ai.modeDurationMs - ai.modeMs > def.lockMs) enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      if (modeOver(ai) && ai.attack === 'howl') {
        // The howl only rallies: packmates near have their lunge ready; it goes back to stalking.
        for (const mate of packmates(state, enemy, def.howl?.range ?? 0)) state = replaceEnemy(state, { ...mate, ai: { ...mate.ai, cooldownMs: 0 } });
        enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'approach'), cooldownMs: def.cooldownMs } };
      } else if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: cutName });
        enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'attack', cutDef.lungeMs), contact: 'none' } };
      }
      break;
    case 'attack': {
      const speed = cutDef.lungeDistance / cutDef.lungeMs;
      enemy = moveEnemy(state, enemy, scale(ai.attackDir, speed * ms));
      const hit = contactPlayer(state, enemy, def.attack, lungeTouches(enemy, state.player.pos), events);
      state = hit.state;
      enemy = { ...enemy, ai: { ...enemy.ai, contact: hit.contact } };
      // Pawniard: the first cut always chains into the second (hit, dodged or missed), and on harder tiers the second into a third.
      if (chains && cut === 0 && (hit.contact === 'hit' || modeOver(ai))) {
        enemy = telegraph({ ...enemy, ai: { ...enemy.ai, chain: 1 } }, 'lunge2', def.followUp!.telegraphMs, toPlayer, events);
        break;
      }
      if (third && cut === 1 && (hit.contact === 'hit' || modeOver(ai))) {
        enemy = telegraph({ ...enemy, ai: { ...enemy.ai, chain: 2 } }, 'lunge3', third.telegraphMs, toPlayer, events);
        break;
      }
      const done = (recoverMs: number): EnemyState => {
        // Harder tiers (Ekans): the lunge leaves a hazard where it ends.
        if (def.landingHazard && atLeast(tier, def.landingHazard.minDifficulty)) state = spawnShot(state, enemy, { ...def.landingHazard.hazard, speed: 0 }, ai.attackDir, enemy.pos);
        const { chain: _cut, ...rest } = enemy.ai;
        return { ...enemy, ai: { ...enterMode(rest, 'recover', recoverMs), cooldownMs: def.cooldownMs } };
      };
      if (hit.contact === 'hit') {
        if (def.drainHp) enemy = { ...enemy, hp: Math.min(enemy.maxHp, enemy.hp + def.drainHp) };
        enemy = done(def.hitRecoverMs);
      } else if (modeOver(ai)) {
        enemy = done(def.missRecoverMs);
      }
      break;
    }
    case 'recover':
      if (modeOver(ai)) {
        const strafeSign = ai.strafeSign === 1 ? -1 : 1;
        enemy = { ...enemy, ai: { ...enterMode(ai, 'approach'), strafeSign } };
      }
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

/** Living enemies of the same species within `range` of `enemy` (a pack). */
function packmates(state: WorldState, enemy: EnemyState, range: number): EnemyState[] {
  return state.enemies.filter((e) => e.id !== enemy.id && e.alive && e.species === enemy.species && distance(e.pos, enemy.pos) <= range);
}

/** Casters: keep a distance band, telegraph and cast a slow ball (Gastly floats; Duskull floats and its wisp bends towards you) or a fan of threads (Spinarak walks). */
function updateCaster(state: WorldState, start: EnemyState, def: GastlyDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const ai = enemy.ai;

  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'reposition') };
      break;
    case 'reposition': {
      const inBand = dist >= def.minDistance && dist <= def.maxDistance;
      if (inBand && ai.cooldownMs <= 0) {
        enemy = telegraph(enemy, 'ball', def.telegraphMs, toPlayer, events);
        break;
      }
      const radial = dist < def.minDistance ? scale(toPlayer, -1) : dist > def.maxDistance ? toPlayer : vec(0, 0);
      const dir = normalize(add(radial, scale(perpendicular(toPlayer, ai.strafeSign), 0.5)));
      enemy = { ...moveEnemy(state, enemy, scale(dir, (def.speed * ms) / 1000)), facing: toPlayer };
      break;
    }
    case 'telegraph':
      enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: 'ball' });
        // Harder tiers (Duskull): the cast becomes a fan.
        const fan = def.hardSpread && atLeast(worldDifficulty(state), def.hardSpread.minDifficulty) ? def.hardSpread : def.spread;
        for (const dir of spreadDirections(enemy.ai.attackDir, fan?.count ?? 1, fan?.degrees ?? 0)) state = spawnShot(state, enemy, def.projectile, dir);
        enemy = { ...enemy, ai: enterMode(enemy.ai, 'attack', def.castMs) };
      }
      break;
    case 'attack': {
      // Harder tiers (Gastly): a second ball part way into the cast, aimed anew.
      const second = def.secondBall && atLeast(worldDifficulty(state), def.secondBall.minDifficulty) ? def.secondBall : null;
      if (second && ai.modeMs - ms < second.delayMs && ai.modeMs >= second.delayMs) state = spawnShot(state, enemy, def.projectile, toPlayer);
      if (modeOver(ai)) enemy = { ...enemy, ai: { ...enterMode(ai, 'recover', def.recoverMs), cooldownMs: def.cooldownMs } };
      break;
    }
    case 'recover':
      if (modeOver(ai)) {
        const strafeSign = ai.strafeSign === 1 ? -1 : 1;
        enemy = { ...enemy, ai: { ...enterMode(ai, 'reposition'), strafeSign } };
      }
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

/** Tanks (Pumpkaboo Super, Trevenant, Golett): walk in slowly, a long wind-up, then a ground slam around them (Golett: in front, aim fixed; Trevenant: and a ring of leaves). */
function updateSlammer(state: WorldState, start: EnemyState, def: SlammerDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const ai = enemy.ai;

  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    case 'approach': {
      if (ai.cooldownMs <= 0 && dist <= def.slamRange) {
        enemy = telegraph(enemy, 'slam', def.telegraphMs, toPlayer, events);
        break;
      }
      const dir = pathDirection(state, enemy, target, def.floats === true) ?? toPlayer;
      // Close enough to slam: hold the ground while the slam recharges.
      if (dist > def.slamRange * 0.6) {
        // Grimer: a blob of sludge where it was, every `everyMs` of walking.
        const every = def.trail?.everyMs;
        if (def.trail && every && Math.floor((ai.modeMs - ms) / every) < Math.floor(ai.modeMs / every)) {
          state = spawnShot(state, enemy, { ...def.trail.puddle, speed: 0 }, dir, enemy.pos);
        }
        enemy = moveEnemy(state, enemy, scale(dir, (def.walkSpeed * ms) / 1000));
      }
      enemy = { ...enemy, facing: dir };
      break;
    }
    case 'telegraph':
      // A frontal slam (Golett) keeps the aim it started with: step around it.
      if (def.arcDegrees === undefined) enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: 'slam' });
        if (def.ring) for (const dir of spreadDirections(toPlayer, def.ring.count, 360 - 360 / def.ring.count)) state = spawnShot(state, enemy, def.ring.projectile, dir);
        // Harder tiers (Golett): rubble thrown all around with the slam.
        const rubble = def.hardRing && atLeast(worldDifficulty(state), def.hardRing.minDifficulty) ? def.hardRing : null;
        if (rubble) for (const dir of spreadDirections(enemy.ai.attackDir, rubble.count, 360 - 360 / rubble.count, 180 / rubble.count)) state = spawnShot(state, enemy, rubble.projectile, dir);
        if (def.puddle) state = spawnShot(state, enemy, { ...def.puddle, speed: 0 }, toPlayer, enemy.pos);
        enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'attack', def.slamMs), contact: 'none' } };
      }
      break;
    case 'attack': {
      const hit = contactPlayer(state, enemy, def.attack, slammerTouches(enemy, state.player.pos, def), events);
      state = hit.state;
      enemy = { ...enemy, ai: { ...enemy.ai, contact: hit.contact } };
      if (modeOver(ai)) enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'recover', def.recoverMs), cooldownMs: def.cooldownMs } };
      break;
    }
    case 'recover':
      if (modeOver(ai)) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

/** Foongus: stands still; when a player comes close it puffs and leaves a spore cloud on the spot. */
function updateSpore(state: WorldState, start: EnemyState, def: SporeDef, target: Vec2, events: GameEvent[]): WorldState {
  let enemy = start;
  const ai = enemy.ai;
  const toPlayer = towardTarget(target, enemy);
  switch (ai.mode) {
    case 'idle':
    case 'approach':
      enemy = { ...enemy, facing: toPlayer };
      if (ai.cooldownMs <= 0 && distance(enemy.pos, target) <= def.triggerRange) enemy = telegraph(enemy, 'spores', def.telegraphMs, toPlayer, events);
      break;
    case 'telegraph':
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: 'spores' });
        state = spawnShot(state, enemy, { ...def.cloud, speed: 0 }, toPlayer, enemy.pos);
        enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'recover', def.recoverMs), cooldownMs: def.cooldownMs } };
      }
      break;
    case 'recover':
      if (modeOver(ai)) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

/** A stagger cancels a wind-up or an attack in progress. */
function interrupted(enemy: EnemyState): EnemyState {
  if (enemy.ai.mode !== 'telegraph' && enemy.ai.mode !== 'attack') return enemy;
  const def = ENEMY_BEHAVIOUR[enemy.species];
  const mode: AiMode = def?.kind === 'caster' ? 'reposition' : 'approach';
  const { chain: _cut, ...ai } = enemy.ai;
  return { ...enemy, ai: enterMode(ai, mode) };
}


/** Runs every enemy's behaviour for one step at the enemy time scale, each going for its nearest present player. */
export function updateEnemies(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  const ms = dtMs * enemyTimeScale(state);
  // Harder tiers: shorter telegraphs (never below the readable floor) and shorter cooldowns (core/difficulty.ts).
  const tier = worldDifficulty(state);
  let current = state;
  for (const { id } of state.enemies) {
    const enemy = current.enemies.find((e) => e.id === id);
    const def = enemy && ENEMY_BEHAVIOUR[enemy.species];
    if (!enemy || !def || !enemy.alive || enemy.ai.mode === 'dormant' || enemy.ai.mode === 'asleep') continue;
    // Koffing's fuse cannot be staggered out of (killing it is the answer).
    if (enemy.hitstunMs > 0 && !unstoppable(enemy)) {
      current = replaceEnemy(current, interrupted(enemy));
      continue;
    }
    const ticked = { ...enemy, ai: tickAiAt(enemy.ai, ms, tier, enemy.elite) };
    const target = targetOf(current, enemy).pos;
    if (def.kind === 'lunger') current = updateLunger(current, ticked, def, target, ms, events);
    else if (def.kind === 'caster') current = updateCaster(current, ticked, def, target, ms, events);
    else if (def.kind === 'slammer') current = updateSlammer(current, ticked, def, target, ms, events);
    else if (def.kind === 'spore') current = updateSpore(current, ticked, def, target, events);
    else if (def.kind === 'archer') current = updateArcher(current, ticked, def, target, ms, events);
    else if (def.kind === 'thief') current = updateThief(current, ticked, def, target, ms, events);
    else if (def.kind === 'boss') current = updateBoss(current, ticked, def, target, ms, events);
    else current = updateRoster(current, ticked, def, target, ms, events);
  }
  return current;
}
