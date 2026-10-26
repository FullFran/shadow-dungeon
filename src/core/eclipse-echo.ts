import type { EclipseCard, EclipseEchoDef, EnemyAttackDef } from '../data/enemies';
import { ENDLESS } from '../data/endless';
import type { SpeciesId } from '../data/species';
import { echoEncounter } from './eclipse-escalation';
import { contactPlayer, enterMode, moveEnemy, replaceEnemy, rotate, spawnShot, towardTarget } from './brain';
import type { AiState, BossState, EnemyState, GameEvent, WorldState } from './state';
import { TUNING } from '../data/tuning';
import { add, angleOf, distance, dot, length, normalize, scale, sub, vec, type Vec2 } from './vec';

/**
 * "Eco del Eclipse", the Sima's own boss (data/enemies.ts `ECLIPSE_ECHO`):
 * between cards it drifts to the top of its arena; each card is announced
 * (`bossStance`, the HUD banner reads the name), winds up and plays out. The
 * volleys are pure functions of the card, its aim and the wave, so the
 * safe path can be tested; the corona and the noose are zones checked
 * victim-side on every peer (`eclipseZoneContact`).
 *
 * It wears a player's shape (odd/tasks/shiny-echo.md): `echoMimic` picks
 * whose, and the world keeps it as `echoMimic` for the renderer and the
 * names. Nothing here reads it: its cards are the same whoever it copies.
 */

/**
 * The species the echo of floor `floor` copies: one player of the party per
 * encounter, in turn over the player ids sorted (solo: always the player),
 * as each one plays now (its current form). The same on every peer, which
 * all hold the host's roster. Null with nobody to copy.
 */
export function echoMimic(floor: number, party: readonly { id: string; species: SpeciesId }[]): SpeciesId | null {
  if (party.length === 0) return null;
  const sorted = [...party].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sorted[(echoEncounter(floor) - 1) % sorted.length]!.species;
}

const DEG = Math.PI / 180;
const PLAYER_R = TUNING.player.radius;

/**
 * Cards it plays on a floor: two on its first, one more each further eclipse
 * floor, plus the def's `extraCards` (one from hard: data/sima-tricks.ts,
 * through `behaviourFor`); at most all.
 */
export function eclipseCardCount(def: EclipseEchoDef, floor: number): number {
  const every = ENDLESS.eclipseEvery ?? 10;
  const extra = Math.max(0, Math.floor(floor / every) - 1) + def.extraCards;
  return Math.min(def.cards.length, def.baseCards + extra);
}

/** The largest angle between neighbouring directions (the widest way through a volley), in degrees. */
export function maxGapDegrees(dirs: readonly Vec2[]): number {
  if (dirs.length < 2) return 360;
  const angles = dirs.map((d) => ((angleOf(d) / DEG) % 360 + 360) % 360).sort((a, b) => a - b);
  let widest = 360 - angles[angles.length - 1]! + angles[0]!;
  for (let i = 1; i < angles.length; i++) widest = Math.max(widest, angles[i]! - angles[i - 1]!);
  return widest;
}

/** A ring of `count` with `gap` shots missing, the gap centred on `aim` and turned `turn` shots more each wave. */
export function ringDirections(ring: EclipseEchoDef['ring'], aim: Vec2, wave: number): Vec2[] {
  const step = 360 / ring.count;
  const centre = (wave * ring.turn) % ring.count;
  const out: Vec2[] = [];
  for (let i = 0; i < ring.count; i++) {
    const offset = (((i - centre) % ring.count) + ring.count) % ring.count;
    // The gap: `gap` shots around the centre (one side gets the odd one).
    if (offset < Math.ceil(ring.gap / 2) || ring.count - offset <= Math.floor(ring.gap / 2)) continue;
    out.push(rotate(aim, i * step));
  }
  return out;
}

/** One emission of a spiral: `arms` shots evenly spread, turned `turnDeg` per emission. */
export const spiralDirections = (spiral: EclipseEchoDef['spiral'], aim: Vec2, emission: number): Vec2[] =>
  Array.from({ length: spiral.arms }, (_, j) => rotate(aim, emission * spiral.turnDeg + (j * 360) / spiral.arms));

/** One emission of the mirrored spirals: two spirals turning opposite ways. */
export const mirrorDirections = (mirror: EclipseEchoDef['mirror'], aim: Vec2, emission: number): Vec2[] =>
  Array.from({ length: mirror.arms }, (_, j) => [rotate(aim, emission * mirror.turnDeg + (j * 360) / mirror.arms), rotate(aim, -emission * mirror.turnDeg + (j * 360) / mirror.arms)]).flat();

/** The lanes' gap centres, wave by wave: from where the player stood, shifting by at most `maxShift`, alternating sides, inside the arena. */
export function laneGaps(lanes: EclipseEchoDef['lanes'], width: number, startX: number): number[] {
  const low = lanes.gapWidth / 2;
  const high = width - lanes.gapWidth / 2;
  const clampX = (x: number) => Math.min(high, Math.max(low, x));
  const gaps = [clampX(startX)];
  for (let k = 1; k < lanes.waves; k++) {
    const previous = gaps[k - 1]!;
    const magnitude = lanes.maxShift * (0.5 + 0.5 * ((k * 0.618) % 1));
    // Alternate sides, but turn back from a wall.
    let shift = k % 2 === 1 ? magnitude : -magnitude;
    if (clampX(previous + shift) === previous) shift = -shift;
    gaps.push(clampX(previous + shift));
  }
  return gaps;
}

/** Where the shots of a lane start across the top edge: every `spacing` px but the gap. */
export function laneXs(lanes: EclipseEchoDef['lanes'], width: number, gap: number): number[] {
  const xs: number[] = [];
  for (let x = lanes.spacing / 2; x < width; x += lanes.spacing) if (Math.abs(x - gap) >= lanes.gapWidth / 2) xs.push(x);
  return xs;
}

/** The corona's safe pockets: the first at `first` (opposite the player when it started), the rest turned around the centre. */
export function coronaPockets(corona: EclipseEchoDef['corona'], centre: Vec2, first: Vec2): Vec2[] {
  const dir = length(sub(first, centre)) > 0 ? normalize(sub(first, centre)) : vec(0, 1);
  return Array.from({ length: corona.pockets }, (_, i) => add(centre, scale(rotate(dir, (i * 360) / corona.pockets), corona.ring)));
}

/** True when a player at `pos` is burned by the corona (outside every pocket). */
export const coronaTouches = (corona: EclipseEchoDef['corona'], centre: Vec2, first: Vec2, pos: Vec2): boolean =>
  !coronaPockets(corona, centre, first).some((p) => distance(p, pos) <= corona.pocketRadius - PLAYER_R * 0.5);

/** The noose's radius `ms` into its closing. */
export const nooseRadius = (noose: EclipseEchoDef['noose'], ms: number): number =>
  noose.fromRadius + (noose.toRadius - noose.fromRadius) * Math.min(1, Math.max(0, ms / noose.closeMs));

/** True when the closing ring touches a player at `pos` (not in its gap, which faces `gapDir`). */
export function nooseTouches(noose: EclipseEchoDef['noose'], centre: Vec2, gapDir: Vec2, ms: number, pos: Vec2): boolean {
  const off = sub(pos, centre);
  const r = length(off);
  if (Math.abs(r - nooseRadius(noose, ms)) > noose.width / 2 + PLAYER_R) return false;
  if (r === 0) return true;
  const cos = dot(normalize(off), normalize(gapDir));
  return Math.acos(Math.max(-1, Math.min(1, cos))) > (noose.gapDegrees / 2) * DEG;
}

const centreOf = (state: { arena: Pick<WorldState['arena'], 'width' | 'height'> }): Vec2 => vec(state.arena.width / 2, state.arena.height / 2);

/** The zone of a corona or noose in play, and whether it touches a player at `pos` (victim-side, every peer). */
export function eclipseZoneContact(state: WorldState, enemy: EnemyState, def: EclipseEchoDef, pos: Vec2): { attack: EnemyAttackDef; touches: boolean } | null {
  if (enemy.ai.mode !== 'attack' || !enemy.boss) return null;
  if (enemy.boss.stance === 'corona') return { attack: def.corona.attack, touches: coronaTouches(def.corona, centreOf(state), enemy.ai.aimPoint ?? centreOf(state), pos) };
  if (enemy.boss.stance === 'noose') return { attack: def.noose.attack, touches: nooseTouches(def.noose, centreOf(state), enemy.ai.attackDir, enemy.ai.modeMs, pos) };
  return null;
}

const withAi = (enemy: EnemyState, ai: AiState): EnemyState => ({ ...enemy, ai });
const withBoss = (enemy: EnemyState, boss: Partial<BossState>): EnemyState => ({ ...enemy, boss: { ...enemy.boss!, ...boss } });

/** Emissions of a card and the time between them (zones: one "emission" lasting the whole attack). */
function cadence(def: EclipseEchoDef, card: EclipseCard): { count: number; intervalMs: number; durationMs: number } {
  switch (card) {
    case 'ring':
      return { count: def.ring.waves, intervalMs: def.ring.intervalMs, durationMs: def.ring.waves * def.ring.intervalMs };
    case 'spiral':
      return { count: def.spiral.emissions, intervalMs: def.spiral.intervalMs, durationMs: def.spiral.emissions * def.spiral.intervalMs };
    case 'mirror':
      return { count: def.mirror.emissions, intervalMs: def.mirror.intervalMs, durationMs: def.mirror.emissions * def.mirror.intervalMs };
    case 'lanes':
      return { count: def.lanes.waves, intervalMs: def.lanes.intervalMs, durationMs: def.lanes.waves * def.lanes.intervalMs };
    case 'corona':
      return { count: 0, intervalMs: 0, durationMs: def.corona.flashMs };
    case 'noose':
    default:
      return { count: 0, intervalMs: 0, durationMs: def.noose.closeMs };
  }
}

/** Spawns shots along `dirs` (from `at`, or from the body), never above its own cap of enemy shots in the air (`maxShots`; `spawnShot` keeps the global one). */
function volley(state: WorldState, enemy: EnemyState, def: EclipseEchoDef, dirs: readonly Vec2[], speed = def.shot.speed, at?: (i: number) => Vec2): WorldState {
  const room = def.maxShots - state.projectiles.filter((p) => p.owner === 'enemy').length;
  let next = state;
  const shot = { ...def.shot, speed };
  dirs.slice(0, Math.max(0, room)).forEach((dir, i) => (next = spawnShot(next, enemy, shot, dir, at?.(i))));
  return next;
}

function emit(state: WorldState, enemy: EnemyState, def: EclipseEchoDef, card: EclipseCard, index: number): WorldState {
  const aim = enemy.ai.attackDir;
  switch (card) {
    case 'ring':
      return volley(state, enemy, def, ringDirections(def.ring, aim, index));
    case 'spiral':
      return volley(state, enemy, def, spiralDirections(def.spiral, aim, index));
    case 'mirror':
      return volley(state, enemy, def, mirrorDirections(def.mirror, aim, index));
    case 'lanes': {
      const gap = laneGaps(def.lanes, state.arena.width, enemy.ai.aimPoint?.x ?? state.arena.width / 2)[index]!;
      const xs = laneXs(def.lanes, state.arena.width, gap);
      return volley(state, enemy, def, xs.map(() => vec(0, 1)), def.lanes.speed, (i) => vec(xs[i]!, def.shot.radius + 2));
    }
    default:
      return state;
  }
}

function startCard(state: WorldState, enemy: EnemyState, def: EclipseEchoDef, target: Vec2, events: GameEvent[]): EnemyState {
  const count = eclipseCardCount(def, state.depth);
  const card = def.cards[enemy.boss!.combosDone % count]!;
  const centre = centreOf(state);
  const toPlayer = towardTarget(target, enemy);
  // The corona's first pocket opposite the player; the lanes' first gap where the player stands; the noose's gap away from the player.
  const away = length(sub(target, centre)) > 0 ? normalize(sub(centre, target)) : vec(0, 1);
  const aimPoint = card === 'corona' ? add(centre, scale(away, def.corona.ring)) : card === 'lanes' ? vec(target.x, 0) : undefined;
  const attackDir = card === 'noose' ? away : toPlayer;
  const durationMs = card === 'corona' ? def.corona.telegraphMs : card === 'noose' ? def.noose.telegraphMs : def.telegraphMs;
  events.push({ type: 'bossStance', enemyId: enemy.id, stance: card });
  // The corona and the noose are positional: their wind-up carries `pierceRoll` (the zone warning sound and the "!").
  const pierce = (card === 'corona' && def.corona.attack.pierceRoll) || (card === 'noose' && def.noose.attack.pierceRoll);
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: card, durationMs, ...(pierce ? { pierceRoll: true as const } : {}) });
  const { aimPoint: _old, ...ai } = enemy.ai;
  return withBoss(withAi(enemy, { ...enterMode(ai, 'telegraph', durationMs), attackDir, contact: 'none', ...(aimPoint ? { aimPoint } : {}) }), { stance: card, stanceMs: 0, comboIndex: 0 });
}

export function updateEclipse(state: WorldState, start: EnemyState, def: EclipseEchoDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  if (!start.boss) return state;
  let enemy = withBoss(start, { stanceMs: start.boss.stanceMs + ms });
  const ai = enemy.ai;
  const card = enemy.boss!.stance as EclipseCard;
  switch (ai.mode) {
    case 'idle':
      if (distance(enemy.pos, target) <= def.aggroRange) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: def.restMs * 0.6 });
      break;
    case 'approach': {
      // Drift to its place at the top of the arena, then play the next card.
      const hover = vec(state.arena.width * def.hover.x, state.arena.height * def.hover.y);
      const to = sub(hover, enemy.pos);
      if (length(to) > 2) enemy = moveEnemy(state, enemy, scale(normalize(to), Math.min(length(to), (def.driftSpeed * ms) / 1000)));
      enemy = { ...enemy, facing: towardTarget(target, enemy) };
      if (ai.cooldownMs <= 0) enemy = startCard(state, enemy, def, target, events);
      break;
    }
    case 'telegraph':
      if (ai.modeMs >= ai.modeDurationMs) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: card });
        enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', cadence(def, card).durationMs), contact: 'none' });
      }
      break;
    case 'attack': {
      const { count, intervalMs, durationMs } = cadence(def, card);
      let index = enemy.boss!.comboIndex;
      while (index < count && ai.modeMs >= index * intervalMs) state = emit(state, enemy, def, card, index++);
      enemy = withBoss(enemy, { comboIndex: index });
      // The corona and the noose: the zone meets the host's own player (guests check theirs, victim.ts).
      const zone = eclipseZoneContact(state, enemy, def, state.player.pos);
      if (zone) {
        const hit = contactPlayer(state, enemy, zone.attack, zone.touches, events);
        state = hit.state;
        enemy = withAi(enemy, { ...enemy.ai, contact: hit.contact });
      }
      if (ai.modeMs >= durationMs && index >= count) {
        enemy = withAi(withBoss(enemy, { combosDone: enemy.boss!.combosDone + 1, comboIndex: 0 }), { ...enterMode(enemy.ai, 'recover', def.recoverMs), contact: 'none' });
      }
      break;
    }
    case 'recover':
      if (ai.modeMs >= ai.modeDurationMs) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: def.restMs });
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

/** The arena's centre (the corona's and the noose's), for the renderer too. */
export const eclipseCentre = centreOf;
