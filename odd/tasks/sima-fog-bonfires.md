# Sima fog walls, bonfires and boss music after the fog

## Objective

Every boss in the game is met the same way, the Sima del Eclipse included: an antechamber with a bonfire and a fog wall, only ambience before the fog (no boss music), and once the party crosses, the boss cinematic (if it has one) and then the boss music with the fight.

## Problem / why (owner report, 2026-10-28)

1. The Sima lacks the fog walls (and a bonfire) the other dungeons have before their boss: its guardian echoes, Eco del Eclipse, heralds and Senda wounds start at once (only lost shadows, the strays, had fog).
2. Boss music starts on room load, before the fog is crossed (`musicFor` from `game.ts` `music()` on `enterFloor`).
3. Owner addition: the boss cinematic plays after crossing the fog, never before. Order: bonfire area (ambience only) -> cross fog -> boss cinematic if any -> boss music with the fight. Every dungeon and co-op.

## Findings (exploration)

- Fog: `core/fog-wall.ts`, `core/run.ts` `fogWallFloor` (room plans except Sima role `echo`; plus strays), `withFogWall`. Shrine trials never get fog (`game.ts` `enterFloor`: `trial ? next.world : withFogWall(...)`).
- Bonfire: `core/bonfire.ts` (mid-boss rooms outside the Sima, lit when the room is cleared) and the closure state in `app/game.ts` (`bonfire`, `bonfireUsed`, `onWipe`, `respawn`, `watchBonfire`); co-op through `{t:'retry'}` (`net/protocol.ts`, `net/session.ts`).
- Music: one selector `musicFor` (`data/dungeons.ts`), one in-run caller `music()` (`game.ts`); each peer plays its own (nothing on the wire). No ambience-only mode exists: silence is `setMusic(null)`; ambience is the room's own sounds.
- Cinematics: the guardian cinematic already plays after crossing (`crossedFog` -> `guardianMoment('pre')`); the Sima's boss scenes (`simaMoment`: first herald, own shadow, someone's shadow) and the herald intro (`heraldMoment`, co-op name card in `announceFloor`) play on floor entry.
- Clock: `tickRunClock` each fixed step in `game.ts`; host sends it in co-op.

## Decisions

- Before the fog there is no music at all (silence, the room's ambience sounds only); the track starts after crossing and after the boss cinematic. `floorMusic(run, world)` (core) returns null while `world.fogWall` is closed.
- Sima: every boss floor (guardian echo, Eco del Eclipse, herald, Senda wound, stray) opens behind a fog wall, solo and co-op.
- Sima bonfire: lit in the antechamber on arrival (the snapshot is the party at the fog). A full wipe in that boss fight may go back to it with the tier's allowance (Fácil unlimited, Normal 3, Difícil 1, Pesadilla none: the same `bonfireRespawns`, shared with nothing else in a Sima run). It covers only its own floor: leaving the floor puts it out, so a wipe on another floor ends the run as before.
- Clock: the eclipse clock stands still while the party is behind the fog (the antechamber is a safe rest, and the fog costs no time compared with before). Going back to the bonfire does not give time back: the clock keeps the time it had at the wipe.
- Shrine trials keep no fog (GDD decision, gauntlet pacing); their boss music starts with the fight as today. Listed as an open question for the owner, not dropped silently.

## Scope

- T1 Music after the fog, cinematic before music: `floorMusic` in core, `game.ts` `music()` uses it, `crossedFog` runs cinematics then music, `restartFloor` resets the music to the antechamber's. Test iterating every dungeon/boss floor.
- T2 Sima fog walls, bonfire and clock: `fogWallFloor`, `bonfireFloor`/`bonfireLights`/bonfire spot, clock pause behind the fog, respawn keeps the clock, Sima boss scenes and herald intro after crossing (solo cinematic, co-op card/log line), GDD, i18n if any new line.

## Tasks

- [x] T1 Boss music and cinematics only after the fog, every dungeon. Route: delegated (single writer across `core/run.ts`, `app/game.ts`, tests). Commit `40d4267`.
- [x] T2 Sima fog walls, bonfire and clock rule. Route: delegated (same writer). Commit `14e4e6b`.

## Parity checklist

- [x] Main dungeons (Crypt, Forest, Caves, Swamp): music null behind the fog, boss track after; guardian cinematic after crossing. Evidence: `tests/core/boss-music.test.ts` iterates `DUNGEONS` floors with fog; `crossedFog` order test.
- [x] Challenge dungeons and Sendas: same. Evidence: `boss-music.test.ts` iterates `CHALLENGES` and `SENDA_ROADS` and fails if any has no fog floor.
- [x] Sima: every boss floor kind (echo, Eco, herald, wound, stray) has fog, a bonfire, no music before, cinematic after. Evidence: `tests/core/sima-fog-bonfire.test.ts` (floors 1-60, all four kinds seen; strays), `boss-music.test.ts` (Sima floors 1-60), `simaMoment('crossed')` in `crossedFog`.
- [x] Shrine: documented (no fog, so its boss music starts with the fight as before; open question for the owner in the GDD fog rule, marked *pendiente*).
- [x] Co-op: the guest's crossing (`crossedFog` on the host snapshot) runs the same sequence (cards instead of cinematics, then music); music is per peer; the Sima bonfire respawn goes through the existing `retry` message (a guest without a snapshot regenerates the floor behind its fog); the clock rule is the same on every peer (`runClockStep` reads the world's fog) and the host's clock still corrects the guest. Existing `tests/net/fog-wall.test.ts`, `tests/net/bonfire.test.ts` green.
- [x] Save/net protocol: no new fields (the bonfire stays per-run closure state in `game.ts`; the fog already syncs as `fogWall: true`).
- [x] i18n es/en for any new line: `bonfire.sima.goText`, `goLeft`, `giveText` (tested over `LANGUAGES`).
- [x] GDD (`docs/gdd.md`): fog rule (Sima bosses, music order, shrine pending), Sima bonfire, clock behind the fog, stray and Sima cinematics after the crossing.
- [x] Sim/prove harnesses: unaffected (they skip the wall); `npm run prove` 166/166 cards, 24/24 fights.

## Checks

`npm run typecheck`, `npx vitest run --testTimeout=30000`, `npm run build`, `npm run prove`.

## Progress

Created 2026-10-28.

- T1: RED observed (`tests/core/boss-music.test.ts`, 5 failing: `floorMusic` missing, `music()` and `crossedFog` order). GREEN: `floorMusic` (core/run.ts) null behind the fog; `game.ts` `music()` uses it; `crossedFog` runs `storyBoss`, the herald card, `simaMoment('crossed')`, `guardianMoment('pre')`, `heraldMoment`, then `music()`; `restartFloor` resets the music; the Sima's boss scenes (first herald, own shadow, someone's shadow) wait for the crossing when the floor has fog (strays: before, they played on entry); the Eco del Eclipse's mimic is picked from the enemies behind the fog too. The echo name card still shows on entry (a floor card, not a cinematic). Full vitest 262 files / 3275 tests green; typecheck clean.
- T2: RED observed (9 failing across `sima-fog-bonfire.test.ts` and the updated `fog-wall`, `bonfire`, `sima-story` tests). GREEN: `fogWallFloor` covers every room plan; `bonfireFloor`/`bonfireLights` cover Sima boss floors (lit on arrival behind the fog); `bonfireSpot` (antechamber, right of the way in) and `bonfireReturn` (keeps the clock); `runClockStep` stops the clock behind the fog; `game.ts` puts the Sima bonfire out on the way down, a snapshot-less guest gets the floor behind its fog, the wipe prompt uses `bonfire.sima.*`. Checks: typecheck clean; vitest 263 files / 3283 tests passed; build ok; prove 166/166 cards, 24/24 fights.

## Open questions for the owner

- Shrine trials have no fog wall (GDD decision kept); should they get one too?
- In Pesadilla (no respawns) the Sima bonfire still says «Hoguera encendida» on arrival, as the main dungeons' mid-boss bonfire does.
