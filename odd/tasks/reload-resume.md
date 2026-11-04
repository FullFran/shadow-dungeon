# Reload-proof play (reload resumes paused, in game)

Objective: reloading (or the tab dying) while in a solo run, a shrine fight or the town brings the player back where they were, with the pause menu open, instead of the title. Branch: `feat/title-hub`.
Delivery: work-unit commits, never push. Runner: `npx vitest run --testTimeout=30000`.

## Specs

- S1: owner (2026-11-04): "Cuando estés in game, si actualizas la página debería pausarte el menú, pero seguir in game".

## Decision: full snapshot, not the floor checkpoint

The world is plain serialisable data (no Map/Set/typed arrays; the RNG is one number in `WorldState.rng`; ids come from a counter), so a JSON round trip is exact: tests restore a run on every dungeon, the Sima and the shrine fights and replay 240 ticks identical to the unrestored run (including a fight that consumes the RNG with crits). The restart checkpoint (`floorStart`) is stored too, but only to keep "Reiniciar planta" working. Nothing within a floor is lost, so no fallback was needed.

## Tasks

- T1 RED/GREEN: `src/app/run-resume.ts` + `tests/app/run-resume.test.ts`: record shape, `parseResume` (version, owner, build, world shape, player up, solo only, one real engine step), writer lifecycle (`end`, `suspend`, tab-owned clear), town record. Done 3d329c3.
- T2 inline: `game.ts` captures (`capturePart`) and restores (`restoreRun`, quiet announce, menu open) the run; saves on floor entry, every 3 s, 0.5 s after a hit, on menu open, on `pagehide` and `visibilitychange`; clears on end, quit and stop; suspends while the player is down.
- T3 inline: `town/scene.ts` `TownHandle.place()`; `main.ts` keeps the town spot (2 s and on page leave), boots into the record (`resumeBoot`), `play(...)` takes the stored run, clears for shared runs.
- T4 inline: i18n `resume.restoring`, `resume.restored` (es, en); GDD (menu de pausa paragraph and §12 note).
- Verified in Brave over CDP (dev server, `?unlock=veteran`): see the report of the change.

## Parity checklist

- [x] Every playable species: the record stores the whole player (species, loadout, items, ranks), `playerOk` checks `isPlayable`; round trips use the default species and the run is species-agnostic (tests/app/run-resume.test.ts)
- [x] Main dungeons, challenges, Senda roads, tutorial, Sima: `everyDungeon = DUNGEONS + CHALLENGES + SENDA_ROADS + TUTORIAL` iterated at floor 1 and a later floor (tests/app/run-resume.test.ts "round-trips every dungeon kind"); Sima clock in "round-trips the Sima"
- [x] Shrine fights (boss, gauntlet, herald): tests "round-trips a shrine fight"; browser: Sableye trial restored with trial index
- [x] Solo vs co-op: shared worlds rejected by `parseResume` (guest, remotes, party > 1, tests "rejects a shared run"); `play()` clears the record when a shared run starts; no rejoin in the net layer, so shared runs keep today's behaviour (pending below)
- [x] Save/migrate/sanitize: own versioned record (`RESUME_VERSION`), sanitized on read, not part of `PROFILE_KEYS` (device-local, never syncs); `SAVE_VERSION` unchanged
- [x] Net protocol: untouched (no new message)
- [x] i18n es/en: `resume.restoring`, `resume.restored` (tests/i18n.test.ts)
- [x] GDD (`docs/gdd.md`): pause menu paragraph and §12 note
- [x] Sim/prove harnesses: not affected (core untouched); `npm run prove` run as a gate
- [x] Defeat/victory/abandon never come back: tests "is cleared when the run ends in ..."; browser: quit and defeat then reload land on the title
- [x] Anti-exploit: restores the same state (damage kept, restarts spent kept, clock stopped); a down player leaves no record (test "rejects a player who is already down")

## Pending (not dropped)

- Co-op: rejoin a room after reload. Needs a stable player identity across pages and the host re-sending state; the net layer only retries the link inside the same page (`PEER_GRACE_MS`). Not invented here.
- Guardian/herald/Sima cinematics in progress are skipped on restore (presentation only).
- Town: an open town window (shop, Maestro...) is dropped; the town menu is what opens.
