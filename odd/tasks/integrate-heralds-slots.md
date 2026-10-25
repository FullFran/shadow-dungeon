# integrate-heralds-slots

## Objective

Bring `feat/procedural-bosses` (Heralds of the Eclipse, their own card framework, Eclipse Echo escalation, intro cutscene) and `feat/four-slots` (boost and area slots) onto `main` (da33dc1: guardian spell cards, fairness, encounters, bounds, balance harness) with one card framework and four-slot input everywhere.

## Problem and why

Both branches were written in parallel with main. procedural-bosses shipped a second card framework in the very files main uses (`src/core/cards.ts`, `src/data/cards.ts`) with a different segment rule, capture judge and reward; four-slots predates main's fairness cap, encounters, gates and gate-aware bots.

## Scope and constraints

- Branch `feat/integrate-heralds-slots` from `main` da33dc1; two `--no-ff` merges, fixes inside the merge commits, one docs commit. No push, no other branch touched, no AI attribution.
- Allowed surfaces: `src/**`, `tests/**`, `tools/**`, `reports/**`, `public/**`, `index.html`, `README.md`, `CREDITS.md`, `docs/gdd.md`, `odd/tasks/**`.

## Checklist

Route: one delegated bounded writer (this worker), inline; no further delegation.

- [x] S1 Merge `feat/procedural-bosses` and unify the card framework - `eea2b33`.
- [x] S2 Merge `feat/four-slots` and unify slots, cap, captures, leaders/gates, touch HUD - `4626eed`.
- [x] S3 Silent screenshots - `/tmp/integrate-heralds-slots/`.
- [x] S4 This document - docs commit.

## Decisions

- **One card framework, main's API as the base** (`src/data/cards.ts`, `src/core/cards.ts`). The procedural-bosses pure API (`cardHpFloor(maxHp, i, n)`, `cardSegment`, `cardEnd`, `timeoutHp`, `trackCapture`, `captureAward`, `CARD_RULES`) is gone. New shared helpers: `segmentFloorShare(shares, index)` (main's `cardFloorShare` now delegates to it) and `equalShares(n)` (a herald's cards). Types `HeraldCardId` / `CardId`; `isHeraldCard`; `cardInfo` answers herald stances (`herald<i>`, `herald<i>x`) with one shared info (`boss.stance.herald`, no guard, no survival).
- **Heralds keep their own proven-fair brain** (`src/core/herald/brain.ts`, the layers the fairness proof simulates) but run on the shared rules: `boss.hpFloor` per equal segment (hits clamp to it, as for guardians), a declaration between cards (`transform`, `HERALD_DECLARE_MS` = 700 ms, the old pre-card pause, invulnerable through `cardGuard`, outcome in `ai.attack`), `spellCardEnd` on every card end, the card clock starting after the declaration, `atHeraldCard` for `?card=N`.
- **One capture rule and reward**: main's `updateCapture` judges heralds too; reward aligned on main's `CAPTURE` (8 coins + 12 % heal; the herald branch paid 6 coins and no heal). Hurt = `playerHurt` or `disguiseBroken` (any hit, whatever slot or buff took it). A boss that falls on a timed-out card in the same step's events (`spellCardEnd` timeout: a herald fading) captures nothing. `CoinTally.captures` is a count of `cardCaptured` events (guardians and heralds), paid in the guardian line; `tallyCapture` removed.
- **One banner/event set**: `bossStance` names the card (game banner: `heraldCardName ?? spellCardKey`); the message log says `card.captured` (+8) and `card.timeout` for every card boss (keys renamed from `sima.herald.capture/timeout`). Boss bar: every card boss gets notches (`segments`) and the host clock (`cardLeftMs`) from `bossBar` (`heraldBar` for heralds); the herald label is `Name · i/n` in its theme colour.
- **Fairness**: herald fairness now measures wind-ups with main's `effectiveTelegraphMs` (positional = pockets, as `pierceZone`). The generator already guarantees scaled >= floor + 40, so generated heralds are unchanged (same names and seeds in tests). Herald shots: `maxShots` 130 < `ENEMY_SHOT_CAP` 160 (test); the one-hit cap is universal in `landHitOnPlayer` and `referenceLevel` is set before `loadRoom` (test). `pierceZone` and `guestEnemyContacts` herald branches merged cleanly.
- **Herald floors** 22, 32, 42... never hit a multiple of 5 or 10 (test up to 600); they are room plans, so `chooseGate` never runs there and no leaders/bands spawn (test). `herald` joins `BOSS_KINDS` (party scaling: the party-scaling test demanded boss class = boss state).
- **Four slots**: bots always emit four `slots`/`slotMouse` entries (boost/area only pressed with `--slots`); test `IDLE` has four entries; old two-entry test inputs still work through the back-compat merge. Bulk Up's x0.6 guard moved before the one-hit reference cap (the cap stays the last multiplier). Golden digest: `twoSlots(plain(...))` projection kept, digest unchanged.
- **Touch HUD**: the slot windows moved from the bottom right (under the action buttons) to two rows under the status window, top left; a layout test derives the `.touch-cluster` box from `index.html` for 844x390, 740x360, 640x360, 932x430, 1024x768, 568x320 and fails on the old layout (6 failures observed with `touch: false`).

## Conflicts and resolutions

- S1: `README.md` (kept both: herald text + `?card=N`, now also for heralds), `src/adapters/hud.ts` (one bar: herald label/colour + main's notches and clock), `src/core/cards.ts`, `src/data/cards.ts`, `tests/core/cards.test.ts` (add/add: main's version + unification), `src/core/coins.ts` (count of captures), `src/core/run.ts` (main's `referenceLevel`/gate reset + herald floor), `src/core/state.ts` (both field sets; `BossStance` includes `HeraldStance`; events carry `CardId`), `src/i18n/en.json`, `es.json` (both key sets). Follow-up fixes in the merge: herald brain, `app/herald-run.ts` (judge removed), `app/game.ts`, message log, fairness telegraph, party boss class, herald tests rewritten onto `updateCapture`.
- S2: `README.md` (four-slot loadout sentence onto main's paragraph), `src/app/game.ts` (both: herald dev seed + touch button hiding), `src/sim/observe.ts` (both imports), `src/sim/runner.ts` (`BOT_PROFILES` + `BotContext`).

## Verification evidence

- `npm test`: 172 files, 1638 tests passed (after S2). After S1: 164 files, 1564 passed. Herald fairness audit (default 240 seeds, `herald-fairness-0/1/2`) passed in both.
- `npm run build`: ok after S1 and S2.
- `npm run balance -- --quick`: 60 runs, 72 arena fights, 0 failures, 39 warnings, 74 passes (same summary as main's recorded quick run).
- `npm run balance -- --quick --slots`: 0 + 1 failure, 41 warnings, 71 passes: `FAIL unseen-threats toxic-swamp/nightmare: 2 at once (F5 salazzle)`. Only with the opt-in slot bots; main dropped toxic-swamp from the unseen-threats known violations in dd6b996. Not added back to `KNOWN_VIOLATIONS` (a dungeon-wide entry would also mask the default sweep); left for a content fix (P5.1 off-screen wind-ups). The committed full report was not regenerated (no full sweep run).
- New tests: `tests/core/herald-integration.test.ts` (floors vs echoes, no gate/leader on herald floors, shared card info and shares, declaration + guard + bar, broken segment -> `spellCardEnd` + outcome, `?card=N`), `tests/core/four-slots-integration.test.ts` (guard before cap, guarded hit spoils a capture, area move fells a seal target and a leader), touch layout tests in `tests/adapters/four-slots-input.test.ts`, herald captures through `updateCapture` in `tests/app/herald-run.test.ts`.
- Screenshots (headless Firefox over WebDriver BiDi on 9733, profile `user.js` `media.volume_scale` 0.0, settings `muted: true` stored before load; dev server 4733; both stopped after, only PIDs this worker started) in `/tmp/integrate-heralds-slots/`: `herald-intro-1.png` (Vaelorion title, seed 1234 floor 32), `herald-card-0.png` (card 2/3 banner «Signo Silvestre «Aguja Devorada»», notched bar, clock 46, four-slot HUD), `aegislash-card2-1.png` / `-5.png` (`?floor=6&card=2`: Juramento «Espadas Flotantes», notched bar + clock, four slots), `touch-844x390.png` (slot windows under the status panel, clear of the buttons). Script: `/tmp/integrate-heralds-slots/scripts/shots.mjs`.

## Not verified

- A guest that sees a herald fade on its last card's timeout may still award itself a capture (guests do not see the host's `spellCardEnd`); the host and solo do not.
- On touch the dungeon's intro title (first seconds of a floor) is drawn over the new slot windows (`touch-844x390-intro.png`); transient, the HUD is clear afterwards.
- No real-device touch check; no co-op session on a herald floor beyond the existing snapshot tests.

## Next step

Push / PR are the user's decision. Optional: fix or record the `--slots` unseen-threats warning in the Salazzle arena.
