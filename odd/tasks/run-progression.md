# In-run progression

## Objective
Give each run its own power curve and build variety: in-run levels from experience, a pick-1-of-3 held item on every new floor, and berries on the floor. Everything resets when the run ends (permanent meta-progression comes later).

## Problem
Runs feel the same from floor 1 to the boss: the player never grows, so there is no build and little reason to explore. The user asked for roguelike in-run progression before permanent progression (2026-10-25).

## Design (provisional numbers live in data)
- **Levels:** defeated enemies give experience (by species and depth). Each level gives small max HP and damage increases; level-up heals the HP gained, shows "¡Mimikyu subió al nivel N!" and plays a sound. Level 1 at run start. In co-op every present player gets the experience for every enemy defeated (Mystery Dungeon style).
- **Held items:** on entering each new floor after floor 1 (including the boss floor), each player picks 1 of 3 held items, offered with rarity weights and seeded from run seed + floor + player id. Items stack for the run. Solo: the game pauses while picking. Shared runs: no pause; the pick overlay shows while the game runs (enemies near the start are asleep).
- **Starting item pool (about 10–12):** Choice Band (more damage, higher stamina costs), Leftovers (slow regen), Quick Claw (faster attacks), Sitrus Berry (one big heal at low HP, per floor), Scope Lens (crit chance), Focus Sash (survive one KO hit per floor at 1 HP), Shell Bell (heal a share of damage dealt), Muscle Band (more damage on the heavy slot), Expert Belt (more damage when super effective), Bright Powder (longer perfect-dodge window), Wide Lens (bigger hitboxes), Rocky Helmet (contact damage to attackers). Official localized names in es.json.
- **Berries:** some rooms spawn an Oran Berry on the floor (seeded); walking over it heals. In shared runs the host is authoritative for pickups (pickup claims, like hit claims).
- **HUD:** level and an XP bar; held item icons (simple drawn icons or text badges; no new art dependency); item tooltips in the Esc menu.

Out of scope: permanent currency, shop, gacha, new species, move-modifying items, item discarding, trading items in co-op.

## Constraints
- Core pure and deterministic; all offers and spawns seeded; architecture test green.
- Solo and the M1 shared run keep working; existing tests green.
- No AI attribution in commits; Conventional Commits. Deploy only with the user's explicit OK.

## Tasks
- [x] T1 Experience and in-run levels (core, data, HUD, sound, co-op XP sharing) (route: delegated writer; trigger: core state/combat, data, adapters, net)
- [ ] T2 Held items: data, effects in core, pick-1-of-3 overlay on floor entry, co-op behaviour (route: same writer)
- [ ] T3 Oran Berries on the floor, host-authoritative pickups in shared runs (route: same writer)
- [ ] T4 Docs: GDD (Spanish) and README (route: same writer)
- [ ] T5 Deploy (route: parent, needs user OK)

## Acceptance criteria
- Same seed gives the same offers and berry placements.
- Each item's effect has a behaviour test.
- A full scripted solo run gains levels and items and stays deterministic.
- `npm test` and `npm run build` pass.

## Checks
`npm test`, `npm run build`.

## Progress
Created 2026-10-25. Forecast ~1200 authored lines.

### T1 (done)
- Data `src/data/progression.ts` (XP by species, `xpPerDepth` 0.5, cumulative level table to level 10, +8 max HP and +5 % damage per level); core `src/core/progression.ts`; `WorldState.depth` (set by the run on each floor) and `WorldState.credited`; `PlayerState.level`/`xp`; `levelUp` event -> HUD flash "¡Mimikyu subió al nivel N!", `levelUp` sound; HUD level label and XP bar.
- Decision: experience is credited at the end of every step from enemies seen down whose id is not yet credited (reset per floor). That one rule covers solo kills, host-applied guest claims, guest snapshots (stale snapshots that show the enemy alive again never pay twice) and collapse deaths (they count: snapshots do not say why an enemy fell, so every peer agrees). A fainted player is credited nothing, so a level-up never revives.
- Checks: `tests/core/progression.test.ts` RED (module missing) then GREEN (13 tests); `npm test` 364 passed; `npm run build` passed.
- Commit: `feat(core): add in-run experience and levels with co-op sharing`.
