# Items after bosses, events in every dungeon

Objective: replace the item pick on entering each floor with a pick after each boss, and bring the Sima's floor events to every dungeon so items also come from chests and events. Branch `feat/boss-items-events`. Delivery: work-unit commits, push and merge are the owner's. Runners: `npx vitest run --testTimeout=30000`, `npm run prove`, `npm run balance -- --quick`, real browser with `tools/mobile/bidi.mjs`.

## Specs

- S1 No more item pick on entering a floor. `core/run.ts` `offerFor` and the `offer` in `progressRun`/start and everything relying on them.
- S2 A pick of three after each boss falls, when the run goes on: mid-bosses, Sima echoes, heralds and lost shadows (a lost shadow already gives one, do not give two). No pick after the final boss of a run, since nothing follows. Reuse `rewardOffer` and the existing pick flow. Each peer has its own offer. In a shared run a pick does not pause. A bonfire return must not hand out a second pick for the same boss. Shrine trials stay without items.
- S3 Floor events in every dungeon, not only the Sima, as data per dungeon: treasure vault (chest with an item pick), merchant, Eclipse altar pacts, ambush, nest, monster house, wave room. The time crystal depends on the Sima's clock and the hunter on its pressure: Sima only unless they obviously work. Anything in an event that depends on the clock (bonus seconds) does nothing without one. The Sima's own event behaviour and its floors must stay exactly as they are.
- S4 Parity: main dungeons and challenge dungeons/Sendas alike, solo and co-op (host owns the event, guests follow, `simaSync`/`applySimaSync`), minimap markers, end-of-run list, i18n of event texts that say "Sima" or the Eclipse where they would now be wrong in another dungeon. Boss floors and rooms have no events. A test iterates `DUNGEONS` plus `CHALLENGES` and `SENDA_ROADS`.
- S5 Enough items to feel like builds: aim for roughly 3 to 5 items in a normal main dungeon run of 9 floors, counting the boss pick, on average over seeds; measure and report the real figure per dungeon and tier. Tune event weights and chances, as data. An event floor must not be every floor: leave plain floors, about half or more. Numbers are provisional and marked so in the GDD.
- S6 Balance: bosses were tuned with about 8 items, so the game gets harder. Do NOT change boss or enemy stats, or the fairness rules. Run the existing sims before and after on the base commit and on this branch and report the difference. A band that fails only because the owner's rule intends fewer items goes to the owner as a decision, with the numbers, never widened silently. The sim bot keeps taking offered items. The recorded Easy digest is re-recorded only for this rule, saying why.
- S7 No new event kinds (darkness, escort, room challenges, cursed items, roaming boss). Later work.

## Tasks

- T1 S1, S2, S6 (bot) pick after each boss, none on entering a floor; game flow, sim bot, tests, GDD. Inline. Commit 547905b.
- T2 S3, S4 events per dungeon: data, core, co-op, texts, tests, GDD. Inline. Commit 08fb3e4.
- T3 S5, S6 tune and measure items per dungeon and tier (08fb3e4), balance before and after, Sima differential, browser check. Inline. Report commit: the one holding reports/balance/boss-items-events.md.

Route evidence: the parent delegated the whole feature as one bounded writer; inside it no further writer (one behaviour per commit). Risk: item 3 (shared run and sim paths), item 6 (the feel of a run is not caught by tests).

## Parity checklist

- [x] Item pick after each boss: mid-bosses (main and Sendas), Sima echoes, the Eco, wounds, heralds, lost shadows; none after a final boss; none in shrine trials.
- [x] Events: every main dungeon, challenge and Senda road has its data; Sima unchanged (differential).
- [x] Solo and co-op: host owns the event, guests follow; each peer has its own offer.
- [x] Minimap markers, end-of-run list, HUD.
- [x] Save, migrate, sanitize, net protocol: no new field (`offer` was already run state; the event's `dungeon` never goes on the wire).
- [x] i18n es/en; GDD.
- [x] Sim and prove harnesses: the bot picks after bosses and opens chests.
- [ ] Pending, not dropped: new event kinds (darkness, escort, room challenges, cursed items, roaming boss), asked as later work (S7).

## Log

- L1 2026-10-30 owner: "tenemos que ver forma de hacer mas divertido hummm a mi me gusta much opero no se, hay que ponerle mas cosa sque llamen la atencion, eventos en mitad de partida y demas que te fuercen a hacer algo que no sea repetitivo, luego elegir objeto en cada planta... mejor cambialo a despues de cada jefe"
- L2 2026-10-30 owner, choosing option A of "A: eliges objeto tras cada jefe, y el resto se consigue en cofres y sucesos dentro de las plantas. Tendría que llevar los sucesos de la Sima a las mazmorras normales.": "2 A"
- L3 2026-10-30 RED observed before each rule: tests/core/boss-pick.test.ts 13 of 13 failing, tests/core/dungeon-events.test.ts 12 of 14 failing, tests/core/test-floor.test.ts the new case failing.
- L4 2026-10-30 digest: 6e22f931 -> df4db47e (run.offer null; the old offer put back gives 6e22f931) -> 68fd7315 (Crypt events; with CRYPT.events removed it gives df4db47e).
- L5 2026-10-30 Sima differential against a scratch copy of 9db9254: 4500 lines (4 tiers, 25 seeds, floors 1 to 45; event, room, gate, run without offer, world digest at entry and after 240 scripted steps on every third floor with an event): byte identical.
- L6 2026-10-30 browser (Firefox, tools/mobile/bidi.mjs): no pick on entering floors 2 and 3; event on Crypt floor 2 with its log line; pick after Sableye solo; co-op over ?net=local in two iframes: same event on both peers, each its own offer after the mid-boss, world time runs under the pick, each keeps its item. Not seen in a browser: a chest opening (the scripted player died to the guards); covered by tests/core/dungeon-events.test.ts and the sim.
- L7 2026-10-30 tests changed because the rule requires it: tests/core/items, party, run (no offer on entry), bands fixture (`items`), encounters, fairness-floors and the "never adds enemies" case of difficulty-tiers (they measure the rooms, so they now run with the floor events removed).
- L8 2026-10-30 decisions for the owner: difficulty (reports/balance/boss-items-events.md), the toxic-swamp unseen-threats known violation added in src/sim/bands.ts, the full sweep blind hit on Crypt normal.
- L9 2026-10-30 pending outside this feature's edit surface: tools/mobile/shots.mjs and menu-geometry.mjs still expect an item pick on entering floor 2.
