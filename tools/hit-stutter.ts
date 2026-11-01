// How much landing hits freezes the game, per move: the same loop as src/app/game.ts (a 60 Hz frame, hitstop
// from the juice stops the simulation, the network sends every 3 steps), mashing one move at three dummies.
// `frozen` is the share of real time the world stands still; `sendGap` the longest silence towards other players
// (without hitstop: 50 ms; a gap over the 100 ms render delay makes them jump, src/net/session.ts).
//   vite-node tools/hit-stutter.ts [--top=15] [--move=fury-swipes] [--shared]
import { applyEvents, initialJuice, tickJuice, type JuiceState } from '../src/adapters/juice';
import { step } from '../src/core/step';
import { advanceClock, FIXED_DT_MS } from '../src/core/timestep';
import { vec } from '../src/core/vec';
import { createWorld, spawnEnemy } from '../src/core/world';
import type { PlayerInput, WorldState } from '../src/core/state';
import { MOVES, type MoveDef, type MoveId } from '../src/data/moves';

const FRAME_MS = 1000 / 60;
const SEND_EVERY = 3;
const SPOTS = [vec(475, 350), vec(470, 330), vec(470, 370)];
const SLOT_INDEX = { fast: 0, heavy: 1, boost: 2, area: 3 } as const;

interface Row { id: MoveId; hitsPerSec: number; frozen: number; speed: number; sendGap: number; numbersPeak: number }

/** `shared`: a co-op run, where hitstop does not stop the world (src/app/game.ts). */
export function measure(move: MoveDef, { shared = false, seconds = 20 }: { shared?: boolean; seconds?: number } = {}): Row {
  const base = createWorld({ seed: 1, arena: { width: 900, height: 700 }, playerPos: vec(450, 350), species: 'mimikyu' });
  const slot = SLOT_INDEX[move.slot];
  const loadout = [...base.player.loadout];
  loadout[slot] = move.id;
  let world: WorldState = { ...base, player: { ...base.player, loadout, facing: vec(1, 0), disguiseBroken: true } };
  for (const pos of SPOTS) world = spawnEnemy(world, 'gastly', pos, { dormant: true });
  world = { ...world, enemies: world.enemies.map((e) => ({ ...e, hp: 1e7, maxHp: 1e7 })) };
  let juice: JuiceState = initialJuice();
  let accumulator = 0;
  let frozenMs = 0;
  let simMs = 0;
  let steps = 0;
  let lastSend = 0;
  let sendGap = 0;
  let hits = 0;
  let numbersPeak = 0;
  const frames = Math.round((seconds * 1000) / FRAME_MS);
  for (let f = 0; f < frames; f++) {
    const now = f * FRAME_MS;
    const frozen = juice.hitstopMs > 0;
    juice = tickJuice(juice, FRAME_MS);
    if (frozen && !shared) {
      frozenMs += FRAME_MS;
    } else {
      const clock = advanceClock(accumulator, FRAME_MS);
      accumulator = clock.accumulatorMs;
      for (let i = 0; i < clock.steps; i++) {
        // A press of 3 steps every 12: a tap for fast moves, a short hold for charged ones.
        const held = steps % 12 < 3;
        const slots = [false, false, false, false];
        slots[slot] = held;
        const input = { move: vec(0, 0), aim: vec(600, 350), roll: false, slots, slotMouse: [false, false, false, false], lock: false, click: false, wheel: 0 } as unknown as PlayerInput;
        world = step(world, input, FIXED_DT_MS);
        // Dummies stay in reach and the user in place, however hard the blows push them: this measures mashing, not chasing.
        world = { ...world, player: { ...world.player, hp: world.player.maxHp, pos: vec(450, 350) }, enemies: world.enemies.map((e, n) => ({ ...e, pos: SPOTS[n] ?? e.pos, hp: e.maxHp })), projectiles: world.projectiles };
        simMs += FIXED_DT_MS;
        steps++;
        if (steps % SEND_EVERY === 0) {
          sendGap = Math.max(sendGap, now - lastSend);
          lastSend = now;
        }
        hits += world.events.filter((e) => e.type === 'enemyHit').length;
        juice = applyEvents(juice, world.events, world.player.pos);
        numbersPeak = Math.max(numbersPeak, juice.numbers.length);
      }
    }
  }
  return { id: move.id, hitsPerSec: hits / seconds, frozen: frozenMs / (seconds * 1000), speed: simMs / (seconds * 1000), sendGap, numbersPeak };
}

if (!process.env.VITEST) {
  const flag = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
  const only = flag('move');
  const moves = (Object.values(MOVES) as MoveDef[]).filter((m) => (only ? m.id === only : m.power > 0));
  const shared = process.argv.includes('--shared');
  const rows = moves.map((m) => measure(m, { shared })).sort((a, b) => b.frozen - a.frozen);
  console.log('move                 hits/s  frozen  worldSpeed  maxSendGap  numbersPeak');
  for (const r of rows.slice(0, Number(flag('top') ?? 15))) {
    console.log(`${r.id.padEnd(20)} ${r.hitsPerSec.toFixed(1).padStart(6)}  ${(r.frozen * 100).toFixed(0).padStart(5)}%  ${r.speed.toFixed(2).padStart(10)}  ${r.sendGap.toFixed(0).padStart(7)} ms  ${String(r.numbersPeak).padStart(11)}`);
  }
  const worst = rows[0];
  console.log(`moves ${rows.length}, over 25% frozen: ${rows.filter((r) => r.frozen > 0.25).length}, worst ${worst?.id} ${(100 * (worst?.frozen ?? 0)).toFixed(0)}%`);
}
