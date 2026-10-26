# degenerate-builds

## Objective
No build (items × rank effects × Maestro moves × starters) can make the player immortal or trivialise a boss: upgrades stay meaningful and stronger moves stay stronger, but difficulty still comes from the fight's design.

## Problem
User report (2026-10-26): "hay algunas cosas que están muy rotas y hay que balancear, por ejemplo con Campana Concha puedes ser inmortal". `src/core/items.ts` `onHitDealt` heals `damage × 0.12 × bells` (2 stacks → 24 % lifesteal) with no cap, fed by every player hit (zone ticks, chain jumps, split shots of the new rank effects, even the overflow a spell card's HP floor throws away). Boss HP pools dwarf the player's, so the heal outpaces any incoming damage.

## Why
Immortality removes the fight. The rank effects (odd/tasks/move-progression.md) multiplied the number of hits per second, so every per-hit item hook has to be re-checked.

## Scope
- B1 Shell Bell: test first (a face-tanking build with 2 bells + ranked multi-hit moves survives a Nightmare boss it should lose), then the fix: direct hits only, a heal-per-second cap scaled to max HP, numbers picked with the harness; data, GDD (Spanish) and item text (es/en).
- B2 Degenerate-build audit with the sim: Leftovers, Focus Sash + heals, Rocky Helmet, super-armor stacking, i-frame uptime, Will-O-Wisp aura, marks/weakening stacking, Choice Band + Maestro, crit stacking. A harness metric/test (tank bot that must die on Nightmare within a bound; an i-frame uptime ceiling). Fix every real exploit with a regression test.
- B3 Report: exploit → mechanism → fix → before/after metric (reports/balance/degenerate-builds.md).

## Constraints
- Allowed surfaces: odd/tasks/degenerate-builds.md, src/**, tests/**, tools/**, docs/gdd.md, README.md, reports/**.
- Default kits unchanged; golden digest unchanged unless an item or default number legitimately changes (explain).
- `npm run prove` stays 166/166 survivable and 24/24.
- Balance quick report (`npm run balance -- --quick --slots`): explain every diff.
- One work-unit commit per task, Conventional Commits, explicit paths, no AI attribution, no push/merge.

## Delivery strategy
ask-on-risk; forecast ~700 authored changed lines (hooks, a sim harness, tests, report). Branch `balance/degenerate-builds` from main 91408ba; PR slicing is the user's decision.

## Tasks
- [x] B1 Shell Bell: RED tank test, fix (direct hits, per-second cap, numbers), docs/i18n. Route: inline in this bounded writer (the parent delegated the whole feature).
- [x] B2 Degenerate-build audit: tank-bot harness + i-frame uptime metric, fixes with regression tests. Route: inline.
- [ ] B3 Report table. Route: inline.

## Acceptance
- The face-tank test fails before B1 and passes after; every exploit found in B2 has a regression test.
- `npx vitest run --testTimeout=30000`, `npm run build` green; `npm run prove` 166/166 and 24/24; balance quick report diff explained.

## Checks
npx vitest run --testTimeout=30000; npm run build; npm run balance -- --quick --slots; npm run prove.

## Progress
- Branch balance/degenerate-builds from main 91408ba. Baseline: `npx vitest run --testTimeout=30000` 207 files / 2501 tests passed; `npm run balance -- --quick --slots` 0 failures, 41 warnings, 72 passes.
- Harness: src/sim/tank.ts, the tank bot. It never rolls; it walks into a card boss and uses the best ready slot (area, boost, heavy with stamina ≥ 50, else fast) at the floor's expected level with the build under test. `tankFight(..., card)` holds one card forever (clock and boss HP put back every step), so the only end is the player's death; `alive` after 180 s = the build out-heals that card. 46 Nightmare cards (8 card bosses) per build, 184 for the four FULL_BUILD ++ builds; the whole grid runs in about 10 s.
- B1 (route: inline). RED: tests/sim/degenerate-builds.test.ts, three FULL_BUILD ++ builds with two Shell Bells face-tanking card 0 of a Nightmare boss (zorua/aegislash, litwick/decidueye, cubone/salazzle) were all still alive at 180 s (`expected 'alive' to be 'died'`); without items they die in 12, 17 and 16 s. Before the fix two bells made 17 of the 32 card-0 tank fights immortal. Fix: core/items.ts `onHitDealt(player, damage, direct)` heals `shellBellHeal` (0.12, unchanged) × stacks of the HP the hit really took (a spell card's floor overflow no longer heals), only for a direct hit (zone ticks and chain jumps are `minor`; split shards and rethrown boomerangs are new `secondary` projectiles; burns and mark bursts never called it), out of a budget of `shellBellPerSecond` 1 % max HP per second per stack holding at most `shellBellBurstSeconds` 3 s (PlayerState.shellBell = HP drawn, refilled in onTick, absent when full: plain runs unchanged). `sustainPerSecond` 3 %: Leftovers and the bell together never heal more than 3 % max HP/s (the bell fills what Leftovers leaves). Numbers from the harness: at 1.2 %/stack 19 of 184 cards immortal with two bells, 0.6 % → 12, 0.4 % → 10, 1 % → 16 (4 without items); below 1 % the count barely drops because those cards are already near equilibrium for a face-tanker without items (their itemless survival is 80–160 s), so 1 %/stack matches Leftovers' 1 %/stack. GREEN: the three tank tests die in time; tests/core/items.test.ts budget, direct-only and shared-ceiling tests. GDD item table + ceiling paragraph, i18n es/en description.
- B1 checks: `npx vitest run --testTimeout=30000` 208 files / 2507 tests passed; typecheck clean; `npm run balance -- --quick --slots` byte-identical to the baseline (0 failures, 41 warnings, 72 passes; no bot run ends up healing past the new budget).
- B2 (route: inline; the audit is the evidence, every fix has a RED-observed regression test). tools/degenerate-builds.ts plays `AUDIT_BUILDS` (src/sim/tank.ts: each starter's FULL_BUILD and default kit, plus i-frame, drain, super-armor, weakening and U-turn builds, all at rank +2) bare and with `TANK_ITEMS` (every sustain/survival item at its cap) on all 46 Nightmare cards, held; reports immortal cards, *flipped* cards (immortal on a card the starter's bare unranked kit loses within 60 s), i-frame and super-armor uptime and heal per second (over all fight time) → reports/balance/degenerate-builds-audit.md. tools/degenerate-offense.ts (runner `RunOptions.items`) measures the damage side with the perfect bot.
  - Found and fixed: (1) drain (Foul Play +2, Drain Punch, Draining Kiss, Giga Drain) healed its share of every hit uncapped: zorua-iframes (Foul Play ++) held 30 of 46 cards bare at 11.9 % max HP/s → `DRAIN_BUDGET` (data/moves.ts) 1 % max HP/s with a 3 s buffer, on the HP really taken (core/afflictions.ts `afterHit(..., dealt)`, `refillDrain`, PlayerState.drained) → 4 of 46, 1 flipped, 1.2 %/s. (2) Leftovers ×3 = 3 %/s: 37 of 184 full-build cards immortal (2 stacks: 20) → maxStacks 2 and the shared sustain ceiling `sustainPerSecond` 2 %. (3) super-armor renewed by every heavy swing: 90–99 % uptime → a ward rests as long as it ran (`ward.restMs`; `wardActive`), measured 42–46 % (ceiling test 52 %). (4) guard × ward stacking (Bulk Up under a 0.6 ward took 36 %) → `DAMAGE_TAKEN_FLOOR` 0.5 (core/hits.ts; one alone unchanged, never raises damage).
  - Measured, no fix: rank i-frames (Sombra Vil +2, Excavar +1, Golpe Bajo +1, Derribo +2, Nitrocarga/Envite Ígneo) 1–20 % uptime (ceiling test 25 %); Will-O-Wisp +2 aura is damage only and no longer heals (zone ticks feed neither bell nor drain); marks never stack (one pending per enemy) and a weakening replaces the running one (zorua-weaken 2 of 46 bare, 1 flipped); Focus Sash is once per floor (delays the death once); Rocky Helmet is 8 × stacks per contact and heals nothing; Choice Band + Muscle Band ×3 + Expert Belt ×2 + Scope Lens ×3 + Quick Claw ×2 on the full builds: Nightmare arenas won 4/4/2/6 → 2/5/3/9 of 18, median boss TTK −20 to −40 % (card HP floors and declarations bound a fight: no boss skipped); crit chance can pass 100 % but a crit is a flat ×1.5.
  - Residual (reported, not fixed): with every sustain item (`TANK_ITEMS`) the tank bot still holds 0–31 of 46 cards (cubone-iframes 31, zorua-weaken 21, mimikyu-drain 21) because those cards are near equilibrium for a face-tanker even bare (survival 80–177 s) and 2 %/s is the requested ceiling; the unranked kits with the same items hold 10–17.
  - RED observed for the B2 tests against the B1 code (src files swapped back to HEAD temporarily): drain zorua-iframes/aegislash 0, Leftovers mimikyu/dhelmise 1, super-armor ×3 failed; the drain cases decidueye 1 and sableye 2 were then picked from the pre-fix per-card grid (ALIVE before, 10 s and 133 s after).
- B2 checks: `npx vitest run --testTimeout=30000` 208 files / 2523 tests passed; `npm run build` ok; `npm run balance -- --quick --slots` byte-identical to the baseline (0 failures, 41 warnings, 72 passes); `npm run prove` 166 cards (166 survivable), 24/24 solver fights, reports/proof unchanged.

## Next step
B3.
