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
- [x] T2 Atmosphere: palette, decor, floor lore (route: same)
  - Cold grey-violet stone palette for the Crypt; `DungeonDef.decor: 'crypt'`. Decoration drawn in code (`src/adapters/crypt-decor.ts` places it by a fixed tile hash; the renderer draws it): flickering candles with a warm pool of light on 20 % of the lit wall faces, grave slabs with a carved cross on 3.5 % of inner room tiles (never stairs or start; hidden once the collapse takes the tile), a worn red carpet and candles along the top of the fixed arenas, braziers on `cover` pillars (T3) and heaps of gold with twinkling gems for the vault's obstacles. The CC0 town tiles were not used: they are a sunlit village set, not crypt stone.
  - Per-floor lore lines (`DungeonLore.floorKeys`, Crypt only, es+en) on the floor card (the card widens to fit, capped by the view) and, for floor 1, a third line under the title card's subtitle that fades in a beat later. Subtitle "Donde el acero aún espera órdenes" and the "♪ title" note already existed; kept and tested.
  - Screenshot fix: the boss bar printed the raw key `boss.stance.glint`; added `boss.stance.glint`/`gems` and a test that every Crypt boss stance has a name.
  - Evidence: `tests/adapters/crypt-atmosphere.test.ts` RED first (module and keys missing), then GREEN; existing card test kept unchanged (the lore line is optional in `cardLines`). Screenshots `/tmp/crypt/intro-floor1.png`, `contact-floor4.jpg`, `contact-vault.jpg` (Sableye glint lane and star, the steal line in the log, the gem rings, treasure heaps). `npm test` 88 files / 800 tests passed.
- [x] T3 Aegislash arena pillars + phase 2 (route: same)
  - Throne room (`ROOMS.boss`): four 56 px pillars with `cover: true` (they stop every projectile, the player walks around them) and braziers on top (T2 decor).
  - Phase 2 (`AEGISLASH.phase2`, `src/core/boss.ts`): at <= 50 % HP, once and never mid-blow, "El Rey desenvaina" (stance `unsheathe`, a 1.6 s transform that neither blocks nor attacks, double ring, banner). Then faster swaps (Shield 6 s or 80 damage, Blade one combo or 6 s, 600 ms change) and after every Blade one spell card in turn, each followed by an opening and a change back to Shield: Midnight (1.1 s ring telegraph, a spin that hits within 110 px and throws a ring of 12 steel blades, 1.5 s recovery), Oaths (planted shield that blocks from every side while it winds up and fires three aimed fans of 5 blades; lowered for a 1.6 s recovery; hide behind a pillar or roll), Shadow (1.3 s: a dark band along one end of the room with a bright gap in the lane farthest from the player; then a wall of shadow swords every 30 px sweeps the room; pillars stop the swords of their column). Card and lane travel in the existing snapshot fields (`boss.stance`, `boss.comboIndex`, `ai.attackDir`); `phase`/`cardsPlayed` are host-only. Guests: Midnight's spin hits them victim-side; Oaths, Shadow and the unsheathing only throw.
  - Presentation: names in the spell banner and boss bar (es+en), sprite form per card (Oaths and the unsheathing start show the Shield), Midnight ring, Oaths guard ring and fan lanes, Shadow band and safe lane, steel shots as streaks. Dev `?bossHp=0.45` (dev server only) starts a floor's enemies at that HP share to look at phase 2.
  - Balance after the screenshots: Oaths blades lowered from 20 to 15 power (a point-blank fan landed all five blades at once).
  - Decisions: music unchanged (Aegislash and Sableye keep the 16-bit battle theme); the guardian cinematic and the post-fight flow untouched; the Blade combo keeps its phase-1 timings (its chained blows are under 500 ms after a 480 ms opener, as before).
  - Evidence: `tests/core/aegislash-phase2.test.ts` (8 tests) RED first (no pillars, no phase 2), then GREEN; mutation: dropping the cover check fails the pillar and Shadow tests. Phase-1 boss tests unchanged and green. Screenshots `/tmp/crypt/contact-boss-p2.jpg` (unsheathe banner, Midnight ring and blades, pillars with braziers) and `contact-boss-p2late.jpg` (Oaths banner and guard ring; the idle test player then fell, so Shadow was not caught on screen). `npm test` 89 files / 808 tests passed; `npm run build` ok.
- [x] T4 Coins/records/co-op checks + GDD + README (route: same)
  - No code change was needed for coins, records or the protocol: the vault's `role: 'midboss'` already makes the game pay `COINS.midboss` (25, on the guardian line, kept on defeat), `cleared` is still set by a victory (only the last floor's guardian ends a run in victory), and the snapshot already carries any `boss.stance` string with its `comboIndex` and `ai.attackDir`.
  - `tests/core/crypt-meta.test.ts` (characterisation, green on first run by design): Sableye pays 25 on top of the guardian; losing to Aegislash keeps the Forest locked, winning opens it; old saves (a cleared Crypt with best floor 4, and legacy victories without `cleared`) still parse and still open the Forest, and a deeper run raises the best floor to 6; Sableye's and Aegislash's phase-2 cards, lane and aim survive encode/decode and land on a guest with no new snapshot fields.
  - Text: `menu.goal` (Esc menu) now names Sableye and the sixth floor (es+en values changed, no new keys). GDD §3 (Spanish, parentheses, no em dashes): enemy count rule, Crypt collapse weights, XP by species, a new "Cripta del Rey de las Espadas" block in "Mazmorras" (floors, floor lines, enemies, Sableye's cards and theft, the throne room pillars, phase 2 and its three cards, music), §11 mid-boss row names Sableye. README: the Crypt run, collapse weights, Sableye's coins, dev `?bossHp=`.
  - Old saves note: an old best floor 4 meant "reached Aegislash"; it now reads as floor 4 of six. Nothing breaks; the board just shows the old number.
  - Evidence: `npm test` 90 files / 812 tests passed; `npm run build` ok.

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
