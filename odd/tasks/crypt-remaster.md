# Crypt of the Sword King remaster

## Objective
Remaster the first dungeon so it is as epic as the Misty Forest while it stays the entry dungeon (approachable, but "duro"): about six floors, new enemies with their own behaviours, the Sableye mid-boss with two named spell cards, crypt atmosphere and per-floor lore, and Aegislash with a pillared arena and a phase 2.

## Problem
The Crypt is still the M0/M2 run: three generated floors with two enemy species and Aegislash in an empty arena. After the Forest it feels like a tutorial.

## Why
User request 2026-10-25: "remasteriza el primer nivel, ya podemos hacer la primera dungeon también más épica".

## Scope
- T1 Structure + enemies: 6 floors (1-2 generated, 3 mid-boss Sableye, 4-5 generated, 6 Aegislash; provisional, in data). Duskull (slow ghost through walls, steering will-o-wisp), Golett (heavy tank, frontal slam with a locked aim, barely moved by knockback), Pawniard (pairs, fast two-cut lunge whose second cut punishes rolling into it), Sableye mid-boss "el ladrón de gemas" (blinks, steals a held item until you hit it back, two named spell cards). Sprites via the pipeline. Floor 1 stays gentle (same table as before); collapse floors kept.
- T2 Atmosphere: crypt palette, candles and grave slabs drawn in code, braziers on arena pillars, per-floor lore line on the floor card (Touhou style), title card subtitle "Donde el acero aún espera órdenes" and the "♪" track note.
- T3 Aegislash remastered: arena with four pillars that stop shots (cover), phase 2 at 50 % HP ("El Rey desenvaina": faster stance swaps and three named spell cards, one of them a shadow-sword wall that sweeps the arena), telegraphed and fair; guardian cinematic and post-fight unchanged; music unchanged (Aegislash and Sableye on the 16-bit battle theme).
- T4 Coins/records/co-op + GDD: Sableye pays like Trevenant (25), Forest unlock still keyed to the Crypt guardian, old saves valid, new enemies and phases through the existing snapshot fields; GDD section in Spanish.

Out of scope: the endless timed dungeon and returning to town after runs (another writer).

## Constraints
- Core pure and deterministic; architecture test green; `npm test`, `npm run build` green.
- Shared files edited additively; new i18n keys in one contiguous block per language.
- No protocol break: new state goes through `boss.stance`/`comboIndex`, enemy `ai` and projectiles already in the snapshot.
- Conventional Commits, one work-unit commit per task, explicit paths, no AI attribution, no push.
- About 400 authored lines per task is advisory only.

## Tasks
- [x] T1 Structure + new enemies + Sableye + sprites (route: inline writer, this agent; core, data, adapters, tools)
  - Data: `RUN_PLAN` is now the remastered Crypt (1-2 generated, 3 `vault` Sableye mid-boss with an exit, 4-5 generated, 6 `boss`); `CRYPT_SPAWNS` explicit (base 1, half a step per floor, max 4; Poochyena/Gastly first with the M2 weights on floor 1, Duskull and Pawniard pairs from 2, Golett from 4); collapse 25 % on 2, 35 % on 4, 45 % on 5. Species Duskull (Ghost), Golett (Ground/Ghost), Pawniard (Dark/Steel), Sableye (Dark/Ghost) with sprites from the pipeline (0355, 0622, 0624, 0302; CREDITS sprite section regenerated, other sections kept), XP, attack anims.
  - Behaviours: Duskull is a floating caster whose fire wisp steers towards the nearest present player for 2.2 s (`ProjectileState.steer`, host side; guests draw it from snapshots); Golett is a slammer with `arcDegrees` 100 (frontal sector, aim fixed at the wind-up start, knockback scale 0.05); Pawniard is a lunger with `followUp` (second cut, 260 ms re-aimed wind-up; `AiState.chain` host-only); Sableye is a new `thief` kind (`src/core/thief.ts`): Glint (blink out 450 ms, glint beside the player 650 ms, slash, three times, a third of a turn around each time) and Gems (blink to the middle, 900 ms wind-up, three rings of 12, every other ring turned half a gap), boss bar, 1.3 s rest.
  - Theft (`src/core/stolen.ts`): a Glint slash that hurts takes the last held item into `player.stolen`; it comes back on the player's own hit on the thief, when the thief is down or gone, on leaving the room (`enterRoom`), or after 9 s; one at a time, nothing held means nothing taken. Victim-side on every peer (`guestEnemyContacts` too), so nothing new goes over the network. Log lines for both.
  - Also: `cover` obstacles stop projectiles (used by T3); spell banner generalised through `spellCardKey` (any `cardNames`); the loadout matchup roster is now the Crypt's floor-1 species plus its guardian (unchanged text).
  - Existing tests changed on purpose (the Crypt structure changed): run/items/collapse/protocol walk the new plan (vault through its exit, floor 6 Aegislash, collapse weights on 2/4/5); the M2 characterisation tests became "floor 1 identical to M2" (60 seeds), the new plan, a ramp, and music per floor (mid-boss on the battle theme).
  - Evidence: `tests/core/crypt.test.ts` (12 tests) written after the code, so no RED first; mutation checks instead: tracking Golett's aim, removing wisp steering, removing the steal, and removing Pawniard's follow-up each fail their test. `npm test` 87 files / 796 tests passed; `npm run build` ok.
- [ ] T2 Atmosphere: palette, decor, floor lore (route: same)
- [ ] T3 Aegislash arena pillars + phase 2 (route: same)
- [ ] T4 Coins/records/co-op checks + GDD + README (route: same)

## Acceptance criteria
- Crypt plan: 6 floors, mid-boss on 3 (exit), Aegislash on 6; floor 1 generates exactly as before.
- Each new enemy behaviour is covered by a deterministic test; Sableye steals and returns by rule; the item is never lost.
- Aegislash enters phase 2 once at <= 50 % HP; every phase-2 attack telegraphs >= 500 ms; pillars stop shots.
- Sableye pays 25 coins; beating Aegislash still marks the Crypt cleared and opens the Forest; old records still parse.

## Checks
`npm test`, `npm run build`, `git log --format=%B -n 5 | grep -ic co-authored` = 0, headless silent screenshots in `/tmp/crypt/`.

## Forecast
About 1800 authored lines over 4 tasks (T1 ~800, T2 ~250, T3 ~550, T4 ~200) plus sprite assets. Above the ~400 slice budget; the delivery decision stays with the parent.

## Progress
Created 2026-10-25 on `feat/crypt-remaster` from `main` 4c90a5d. Engram mirror: pending (writer has no Engram session; parent owns it).
