// Real multi-touch combat check (headless Firefox, WebDriver BiDi touch pointers, silent):
// the joystick and a skill button at once, drag-to-aim on a charged move and on a
// release-cast move, a plain tap with auto-aim; reads the live world (dev `__mzWorld`).
//   node tools/mobile/combat-check.mjs [--dir=/tmp/mobile] [--left]
import { seedSettings, startFirefox, startVite, wait } from './bidi.mjs';

const args = process.argv.slice(2);
const dir = args.find((a) => a.startsWith('--dir='))?.split('=')[1] ?? '/tmp/mobile';
const leftHanded = args.includes('--left');
const vite = await startVite(4420);
const { page, stop } = await startFirefox(9350);
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(detail)}`);
};
const centre = (id) => page.evaluate(`(() => { const b = document.querySelector('.touch-${id}'); if (!b || b.hidden) return null; const r = b.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.width]; })()`);
const action = () => page.evaluate(`(() => { const a = globalThis.__mzWorld().player.action; return a ? { slot: a.slotIndex, move: a.moveId, dir: a.aimDir, phase: a.phase } : null; })()`);
/** The move once its charge has ended (the lift reaches the page after the touch action returns). */
const released = () => page.evaluate(`new Promise((done) => { const from = performance.now(); const t = setInterval(() => { const a = globalThis.__mzWorld().player.action; if ((a && a.phase !== 'charging') || performance.now() - from > 2000) { clearInterval(t); done(a ? { slot: a.slotIndex, move: a.moveId, dir: a.aimDir, phase: a.phase } : null); } }, 5); })`);
/** Slots that started a move since the last call (sampled every 10 ms in the page). */
const watchSlots = () => page.evaluate(`(clearInterval(globalThis.__mzWatch), globalThis.__mzSeen = [], globalThis.__mzWatch = setInterval(() => { const a = globalThis.__mzWorld().player.action; if (a && !globalThis.__mzSeen.some((s) => s.slot === a.slotIndex)) globalThis.__mzSeen.push({ slot: a.slotIndex, dir: a.aimDir }); }, 10), 1)`);
const seenSlots = () => page.evaluate(`globalThis.__mzSeen`);
/** Until the player is free and every cooldown has run out. */
const ready = () => page.evaluate(`new Promise((done) => { const t = setInterval(() => { const p = globalThis.__mzWorld().player; if (!p.action && !p.roll && p.stamina >= 99 && Object.values(p.cooldowns ?? {}).every((ms) => ms <= 0)) { clearInterval(t); done(1); } }, 20); setTimeout(() => { clearInterval(t); done(0); }, 6000); })`);
const player = () => page.evaluate(`globalThis.__mzWorld().player.pos`);

try {
  for (const [w, h] of [
    [844, 390],
    [390, 844],
  ]) {
    await page.viewport(w, h, 3);
    await seedSettings(page, vite.url, { difficulty: 'easy', touchLeftHanded: leftHanded });
    // A test arena: the enemies stand on an arc to the player's right.
    await page.nav(`${vite.url}?screen=run&spawn=koffing,koffing&seed=3`);
    await wait(3000);
    const tag = `${w}x${h}${leftHanded ? '-left' : ''}`;

    // 1. Joystick (left half) and the main attack at once.
    const fast = await centre('fast');
    const before = await player();
    const stickX = leftHanded ? w * 0.75 : w * 0.25;
    await watchSlots();
    await page.touch([
      [stickX, h * 0.6, 700, 0, -50],
      // A second finger lands a moment later (two downs in one synthetic tick lose the second pointerdown in Firefox).
      [fast[0], fast[1], 80, 0, 0, 120],
    ]);
    const after = await player();
    const seen = await seenSlots();
    check(`${tag} joystick moves while the main attack fires`, after.y < before.y - 5 && seen.some((s) => s.slot === 0), { moved: Math.round(before.y - after.y), seen });
    await ready();

    // 2. A tap on Area with no drag: auto-aim at the enemy in the cone in front (face right first: the enemies are there).
    const area = await centre('area');
    if (area) {
      await page.touch([[stickX, h * 0.6, 60, 40, 0]]);
      await watchSlots();
      await page.touch([[area[0], area[1], 60]]);
      await wait(120);
      const tapCast = (await seenSlots()).find((s) => s.slot === 3);
      const state = await page.evaluate(`(() => { const p = globalThis.__mzWorld().player; return { stamina: p.stamina, cooldowns: p.cooldowns, enemies: globalThis.__mzWorld().enemies.filter((e) => e.alive).map((e) => [Math.round(e.pos.x - p.pos.x), Math.round(e.pos.y - p.pos.y)]) }; })()`);
      check(`${tag} tap casts with auto-aim`, tapCast !== undefined && tapCast.dir.x > 0.5, { tapCast, state });
    }
    await ready();

    // 3. Heavy (charged): hold, drag up, the charge aims up (the enemies are to the right, auto-aim would go right).
    const heavy = await centre('heavy');
    const drag = page.touch([[heavy[0], heavy[1], 900, 0, -80]]);
    await wait(550);
    await page.screenshot(`${dir}/combat-aim-heavy-${tag}.png`);
    const charging = await action();
    await drag;
    const fired = await released();
    check(`${tag} drag on a charged move aims it`, charging?.slot === 1 && charging.dir.y < -0.9, charging);
    check(`${tag} a lifted charged move fires along the drag`, fired?.slot === 1 && fired.phase !== 'charging' && fired.dir.y < -0.9, fired);
    await ready();

    // 4. Area (release-cast): drag left and lift: it casts leftwards on release, not on press.
    if (area) {
      const lift = page.touch([[area[0], area[1], 500, -70, 0]]);
      await wait(300);
      const whileHeld = await action();
      await page.screenshot(`${dir}/combat-aim-area-${tag}.png`);
      await lift;
      await wait(60);
      const cast = await action();
      await wait(250);
      await page.screenshot(`${dir}/combat-cooldown-${tag}.png`);
      check(`${tag} release-cast: nothing while held, cast leftwards on lift`, whileHeld === null && cast?.slot === 3 && cast.dir.x < -0.9, { whileHeld, cast });
      await ready();
    }

  }
} finally {
  await stop();
  vite.stop();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
