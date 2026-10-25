import { describe, expect, it } from 'vitest';
import { SPRITE_KEYS, SPRITES } from '../../src/data/sprites';
import { MOVES } from '../../src/data/moves';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { toPlayerInput, wheelPixels, type RawInput } from '../../src/adapters/input';
import { applyEvents, initialJuice, JUICE, shakeOffset, tickJuice } from '../../src/adapters/juice';
import { attackFrame, directionRow, enemyAnim, enemySprite, frameAtTime, playerAnim } from '../../src/adapters/sprite-anim';
import { cameraView, interpolatedPositions, pixelScaleFor, screenToWorld } from '../../src/adapters/view';
import { barFill, levelUpText } from '../../src/adapters/hud';
import { setLanguage } from '../../src/i18n';
import { IDLE } from '../core/helpers';

describe('direction rows', () => {
  it('maps the 8 directions to the PMD sheet row order', () => {
    const cases: [number, number, string][] = [
      [0, 1, 'down'],
      [1, 1, 'downRight'],
      [1, 0, 'right'],
      [1, -1, 'upRight'],
      [0, -1, 'up'],
      [-1, -1, 'upLeft'],
      [-1, 0, 'left'],
      [-1, 1, 'downLeft'],
    ];
    for (const [x, y, name] of cases) expect(SPRITES.directions[directionRow(vec(x, y))]).toBe(name);
  });

  it('snaps in-between angles to the nearest row and treats zero as down', () => {
    expect(SPRITES.directions[directionRow(vec(1, 0.3))]).toBe('right');
    expect(SPRITES.directions[directionRow(vec(1, 0.7))]).toBe('downRight');
    expect(directionRow(vec(0, 0))).toBe(0);
  });
});

describe('frame timing', () => {
  // 1/60 s ticks: frames of 100 ms, 50 ms, 50 ms.
  const durations = [6, 3, 3];

  it('advances by the sheet durations and loops', () => {
    expect(frameAtTime(durations, 0, true)).toBe(0);
    expect(frameAtTime(durations, 99, true)).toBe(0);
    expect(frameAtTime(durations, 101, true)).toBe(1);
    expect(frameAtTime(durations, 160, true)).toBe(2);
    expect(frameAtTime(durations, 210, true)).toBe(0);
  });

  it('holds the last frame of one-shot animations', () => {
    expect(frameAtTime(durations, 5000, false)).toBe(2);
  });

  it('puts the HitFrame on the active phase and the ReturnFrame on recovery', () => {
    const attack = { durations: [2, 6, 1, 1, 1, 2, 2, 2, 2, 2], hitFrame: 3, returnFrame: 6 };
    expect(attackFrame(attack, 'windup', 0)).toBe(0);
    expect(attackFrame(attack, 'windup', 0.99)).toBeLessThan(3);
    expect(attackFrame(attack, 'active', 0)).toBe(3);
    expect(attackFrame(attack, 'active', 0.99)).toBeLessThan(6);
    expect(attackFrame(attack, 'recovery', 0)).toBe(6);
    expect(attackFrame(attack, 'recovery', 0.99)).toBe(9);
  });

  it('spreads a sheet without markers over the whole move', () => {
    const plain = { durations: [1, 1, 1, 1, 1, 1] };
    expect(attackFrame(plain, 'windup', 0)).toBe(0);
    expect(attackFrame(plain, 'recovery', 0.99)).toBe(5);
  });
});

describe('animation choice', () => {
  const world = () => createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300) });

  it('walks, idles and attacks with the sheet of the move', () => {
    const state = world();
    expect(playerAnim(state.player, { timeMs: 0, sinceHurtMs: Infinity, moving: true }).anim).toBe('Walk');
    expect(playerAnim(state.player, { timeMs: 0, sinceHurtMs: Infinity, moving: false }).anim).toBe('Idle');
    const swinging = step(state, { ...IDLE, aim: vec(500, 300), slots: [true, false], slotMouse: [true, false] }, FIXED_DT_MS);
    const choice = playerAnim(swinging.player, { timeMs: 0, sinceHurtMs: Infinity, moving: false });
    expect(choice.anim).toBe('Attack');
    expect(SPRITES.directions[choice.row]).toBe('right');
    expect(MOVES[swinging.player.action!.moveId].id).toBe('shadow-claw');
  });

  it('shows the Charge sheet when an enemy telegraphs and the stance form for Aegislash', () => {
    let state = spawnEnemy(world(), 'poochyena', vec(330, 300));
    for (let i = 0; i < 5 && state.enemies[0]!.ai.mode !== 'telegraph'; i++) state = step(state, IDLE, FIXED_DT_MS);
    expect(enemyAnim(state.enemies[0]!, { timeMs: 0, sinceDefeatMs: Infinity }).anim).toBe('Charge');

    const boss = spawnEnemy(world(), 'aegislash', vec(200, 200)).enemies[0]!;
    expect(enemySprite(boss)).toBe(SPRITE_KEYS.aegislashShield);
    expect(enemySprite({ ...boss, boss: { ...boss.boss!, stance: 'blade' } })).toBe(SPRITE_KEYS.aegislashBlade);
  });
});

describe('starter sprites', () => {
  const at = vec(100, 100);
  it('draws each species with its own sheet, and Mimikyu Busted once Disguise is spent', () => {
    const zorua = createWorld({ seed: 1, arena: { width: 400, height: 400 }, playerPos: at, species: 'zorua' }).player;
    expect(playerAnim(zorua, { timeMs: 0, sinceHurtMs: Infinity, moving: false }).sprite).toBe(SPRITE_KEYS.zorua);
    const mimikyu = createWorld({ seed: 1, arena: { width: 400, height: 400 }, playerPos: at }).player;
    expect(playerAnim(mimikyu, { timeMs: 0, sinceHurtMs: Infinity, moving: false }).sprite).toBe(SPRITE_KEYS.mimikyu);
    expect(playerAnim({ ...mimikyu, disguiseBroken: true }, { timeMs: 0, sinceHurtMs: Infinity, moving: false }).sprite).toBe(SPRITE_KEYS.mimikyuBusted);
  });

  it('plays an existing sheet for every move of every starter', () => {
    for (const species of ['mimikyu', 'zorua', 'litwick', 'cubone'] as const) {
      const base = createWorld({ seed: 1, arena: { width: 400, height: 400 }, playerPos: at, species }).player;
      for (const moveId of Object.keys(MOVES) as (keyof typeof MOVES)[]) {
        const action = { slotIndex: 0, moveId, phase: 'active' as const, phaseMs: 0, chargeMs: 0, chargeLevel: 0, aimDir: vec(1, 0), mouseAim: false, hitIds: [] };
        const choice = playerAnim({ ...base, action }, { timeMs: 0, sinceHurtMs: Infinity, moving: false });
        expect(SPRITES.sprites[choice.sprite]?.anims[choice.anim], `${species} ${moveId}`).toBeDefined();
      }
    }
  });
});

describe('interpolation and camera', () => {
  it('renders entities between the previous and current step', () => {
    const a = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(100, 100) });
    const b = { ...a, player: { ...a.player, pos: vec(110, 100) } };
    expect(interpolatedPositions(a, b, 0.5).get('player')).toEqual(vec(105, 100));
    const spawned = spawnEnemy(b, 'gastly', vec(300, 300));
    expect(interpolatedPositions(a, spawned, 0.5).get(spawned.enemies[0]!.id)).toEqual(vec(300, 300));
  });

  it('follows the focus but stays inside the arena, and centres small arenas', () => {
    const arena = { width: 1000, height: 600 };
    expect(cameraView(vec(500, 300), 400, 200, arena)).toEqual({ x: 300, y: 200, width: 400, height: 200 });
    expect(cameraView(vec(10, 10), 400, 200, arena)).toMatchObject({ x: 0, y: 0 });
    expect(cameraView(vec(990, 590), 400, 200, arena)).toMatchObject({ x: 600, y: 400 });
    expect(cameraView(vec(50, 50), 400, 200, { width: 300, height: 100 })).toMatchObject({ x: -50, y: -50 });
  });

  it('converts canvas pixels to world points and picks an integer pixel scale', () => {
    expect(screenToWorld(vec(300, 90), { x: 100, y: 50, width: 400, height: 200 }, 3)).toEqual(vec(200, 80));
    expect(pixelScaleFor(1920, 1080, 512, 320)).toBe(3);
    expect(pixelScaleFor(300, 200, 512, 320)).toBe(1);
  });
});

describe('input mapping', () => {
  const raw = (overrides: Partial<RawInput> = {}): RawInput => ({
    keys: new Set(),
    buttons: new Set(),
    mouse: vec(0, 0),
    rollPressed: false,
    wheel: 0,
    ...overrides,
  });
  const view = { x: 100, y: 50, width: 512, height: 320 };

  it('maps WASD, roll, slots (mouse or Q/E), Shift, the left click and the wheel', () => {
    const input = toPlayerInput(raw({ keys: new Set(['KeyD', 'KeyW', 'ShiftLeft', 'KeyE']), buttons: new Set([0]), rollPressed: true, wheel: -100, mouse: vec(20, 40) }), view, 2);
    expect(input.move).toEqual(vec(1, -1));
    expect(input.roll).toBe(true);
    expect(input.slots).toEqual([true, true]);
    expect(input.slotMouse).toEqual([true, false]);
    expect(input.lock).toBe(true);
    expect(input.click).toBe(true);
    expect(input.wheel).toBe(-100);
    expect(input.aim).toEqual(vec(110, 70));
    expect(input.view).toBe(view);
  });

  it('cancels opposite keys and reads the right button as the heavy slot', () => {
    const input = toPlayerInput(raw({ keys: new Set(['KeyA', 'KeyD']), buttons: new Set([2]) }), view, 1);
    expect(input.move).toEqual(vec(0, 0));
    expect(input.slots).toEqual([false, true]);
    expect(input.slotMouse).toEqual([false, true]);
    expect(input.lock).toBe(false);
    expect(input.click).toBe(false);
  });

  it('reads the middle button as the lock toggle and Q as a cursor-free fast slot', () => {
    const middle = toPlayerInput(raw({ buttons: new Set([1]) }), view, 1);
    expect(middle.lock).toBe(true);
    expect(middle.slots).toEqual([false, false]);
    const q = toPlayerInput(raw({ keys: new Set(['KeyQ', 'ShiftRight']) }), view, 1);
    expect(q.slots).toEqual([true, false]);
    expect(q.slotMouse).toEqual([false, false]);
    expect(q.click).toBe(false);
    expect(q.lock).toBe(true);
  });

  it('marks a slot as mouse-triggered when its button is held, even with the key too', () => {
    const both = toPlayerInput(raw({ keys: new Set(['KeyQ', 'KeyE']), buttons: new Set([0, 2]) }), view, 1);
    expect(both.slots).toEqual([true, true]);
    expect(both.slotMouse).toEqual([true, true]);
  });

  it('normalises wheel deltas to pixels', () => {
    expect(wheelPixels(3, 1)).toBe(99);
    expect(wheelPixels(1, 2, 700)).toBe(700);
    expect(wheelPixels(-120, 0)).toBe(-120);
  });
});

describe('juice', () => {
  it('freezes briefly on a hit, longer and with shake on heavy or super-effective hits', () => {
    const light = applyEvents(initialJuice(), [{ type: 'enemyHit', enemyId: 'e1', damage: 5, effectiveness: 1, pos: vec(0, 0) }], vec(0, 0));
    expect(light.hitstopMs).toBe(JUICE.hitstopMs);
    expect(light.shakeMs).toBe(0);
    const heavy = applyEvents(initialJuice(), [{ type: 'enemyHit', enemyId: 'e1', damage: 5, effectiveness: 2, pos: vec(0, 0) }], vec(0, 0));
    expect(heavy.hitstopMs).toBe(JUICE.heavyHitstopMs);
    expect(heavy.shakeMs).toBeGreaterThan(0);
    expect(heavy.numbers[0]).toMatchObject({ value: 5, style: 'super', big: true });
  });

  it('colours numbers by effectiveness and labels blocked hits', () => {
    const juice = applyEvents(
      initialJuice(),
      [
        { type: 'enemyHit', enemyId: 'e1', damage: 3, effectiveness: 0.5, pos: vec(0, 0) },
        { type: 'hitBlocked', enemyId: 'e2', pos: vec(0, 0) },
      ],
      vec(0, 0),
    );
    expect(juice.numbers.map((n) => n.style)).toEqual(['weak', 'blocked']);
  });

  it('flashes on a perfect dodge and ages everything out', () => {
    let juice = applyEvents(initialJuice(), [{ type: 'perfectDodge' }, { type: 'playerHurt', damage: 12 }], vec(5, 5));
    expect(juice.flash?.kind).toBe('perfectDodge');
    expect(juice.numbers[0]).toMatchObject({ value: 12, style: 'hurt', pos: vec(5, 5) });
    expect(shakeOffset(juice, () => 1)).not.toEqual(vec(0, 0));
    juice = tickJuice(juice, 2000);
    expect(juice).toEqual(initialJuice());
    expect(shakeOffset(juice, () => 1)).toEqual(vec(0, 0));
  });
});

describe('level-up feedback', () => {
  it('flashes the level reached and names the species', () => {
    const juice = applyEvents(initialJuice(), [{ type: 'levelUp', level: 3 }], vec(0, 0));
    expect(juice.flash).toEqual({ kind: 'levelUp', ageMs: 0, level: 3 });
    setLanguage('es');
    expect(levelUpText('mimikyu', 3)).toBe('¡Mimikyu subió al nivel 3!');
    setLanguage('en');
    expect(levelUpText('mimikyu', 3)).toBe('Mimikyu grew to level 3!');
    setLanguage('es');
  });
});

describe('HUD bars', () => {
  it('clamps fills to [0, 1]', () => {
    expect(barFill(50, 100)).toBe(0.5);
    expect(barFill(-5, 100)).toBe(0);
    expect(barFill(150, 100)).toBe(1);
    expect(barFill(1, 0)).toBe(0);
  });
});
