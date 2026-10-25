# Integrate the Crypt remaster and the overworld

## Objective
Bring `feat/crypt-remaster` and `feat/overworld` into `main` (c018e1c: Sima del Eclipse, experimental roster, return to town) on `feat/integrate-crypt-world`, with every system still working together: the six-floor Crypt, the Sima and its echoes, the overworld and its town lobby, the net protocol, records and lore.

## Scope
- S1 Merge `feat/crypt-remaster`; decide the Aegislash echo's phase 2; add Duskull, Golett and Pawniard to `ENDLESS_POOL`.
- S2 Merge `feat/overworld`; the crater opens the Sima; unify the way back to town; the host picks the Sima mode in the town lobby; keep both protocol additions.
- S3 Silent screenshots in `/tmp/integrate-crypt-world/`.

Out of scope: push, PR, main.

## Constraints
Conventional Commits, no AI attribution, `npm test` and `npm run build` green after each step, records and leaderboard keys untouched, additive protocol only.

## Tasks
- [x] S1 Crypt remaster merge + Sima pool (route: inline, single integration writer)
- [x] S2 Overworld merge + unified return to town (route: inline, same writer)
- [x] S3 Silent screenshots (route: inline)

## Progress

### S1 `62b1705` merge, `37bdf9f`, `a0cf3c2`
- Conflicts and resolutions:
  - `tools/fetch-sprites.mjs`, `src/data/sprites.ts`, `src/data/species.ts` (both blocks; the `;` moved to the last species), `src/adapters/sprite-anim.ts`, `src/data/progression.ts`: both species sets, roster first, then the Crypt's four.
  - `src/data/sprite-meta.json` (71 hunks): rebuilt as main's JSON plus the four Crypt sprites (0355, 0622, 0624, 0302) appended, the order `fetch-sprites.mjs` writes; diff against main is exactly the Crypt branch's +1210 lines.
  - `CREDITS.md` sprite table: rows merged by artist (sprites in target order, artists sorted like `creditsMarkdown`): AikoMaiko added, baronessfaron/CHUNSOFT/JFain get both sets.
  - `src/data/enemies.ts`: `PoochyenaDef` keeps `weave`/`lockMs` and `followUp`; `SlammerDef` keeps `floats`/`puddle`/`trail` and `arcDegrees`; all roster defs plus `ThiefDef`, Duskull, Golett, Pawniard, Sableye; one `EnemyDef` union with every kind; `ENEMY_BEHAVIOUR` both sets.
  - `src/core/enemies.ts`: imports of both (main's `pathDirection`/`telegraph`, the Crypt's `updateThief`; the Crypt's `flowStep` import dropped, unused after main's refactor); dispatch `thief`, then `boss`, else roster.
  - `src/core/state.ts` (`attack`, `aimPoint`, `chain`), `src/core/victim.ts` (roster contact first, then Aegislash phase-2 stances), `src/data/dungeons.ts` (`endless` and `decor`).
  - `src/adapters/renderer.ts`: the crab shell ring and the Aegislash phase-2 telegraphs as two separate blocks.
  - `src/app/game.ts`: `?clock=`/`?spawn=` start state, then `?bossHp=` on top.
  - `src/i18n/{es,en}.json`: both tail blocks, valid JSON, 508 keys, no duplicates. `README.md`: the Crypt branch's paragraph plus the Sima paragraph, "lead back to the town", `?clock=`, `?spawn=`, `endless|eclipse` screens. `docs/gdd.md` merged cleanly.
  - `tests/core/endless.test.ts`: the guardian floor of the Crypt is `CRYPT.plan.length` (6), not 4.
- Decision, Aegislash echo: phase 2 disabled in Sima echoes (`37bdf9f`). The echo still fights in the remastered throne room with its four cover pillars (the echo exit at the top centre, x 360-440, is clear of them), but never unsheathes. Why: the echo has 60 % HP, hits harder with depth (up to x3) and races the clock; the 1.6 s unsheathing plus three spell cards would nearly double a timed fight and the Shadow wall at x3 damage is a near one-shot. Mechanism: `depthScale(..., echo)` marks `EnemyScale.echo`, and the phase-2 trigger in `src/core/boss.ts` skips it (host-only; no protocol change). Test: `tests/core/aegislash-phase2.test.ts` "stays in phase 1 on an echo floor"; mutation (guard removed) fails it. GDD "Plantas sin fin" says so.
- Pool (`a0cf3c2`): Duskull min 2 weight 2, Pawniard min 2 weight 1 pack 2, Golett min 4 weight 1 (the floors they first walk in `CRYPT_SPAWNS`); Sableye not in the pool (mid-boss, no vault echo). Tests RED first (2 failing without the data), then GREEN: data entries match the Crypt's first floors, never before min depth, seeded floors (4 seeds, floors 1-9 without echoes) show all three and at least one Pawniard pair. The roster/regular weight ratio test at floor 5 still holds (15/19).
- Checks: `npm test` 100 files / 927 tests passed; `npm run build` ok.

### S2 `88d9e6d` merge, `0b887d3`
- Conflicts and resolutions:
  - `src/net/protocol.ts`: header lists `clock` and `town`; `NetMessage` keeps `clock` and `town`; `decodeTown` kept; `KNOWN` has both. `src/net/session.ts`: both `clock` and `town` cases. `hello.name` came in cleanly.
  - `src/town/scene.ts`: `clearedDungeons` import plus main's leaderboard import.
  - `src/app/main.ts`: the overworld's `openLobby` / `townLobby` / `backToRoom` replace the old lobby window; main's endless end screen (`EndScore`, `scoreColumn`, `endlessScore`) kept. `resultScreen` now has one way back per kind of run: a room run goes to `backToRoom` (the room's town, everyone) and every other run to `townScreen` (the hub), decided by the pure `townOf` in `src/app/after-run.ts`; `townScreen` starts with `leaveNet()`, so quitting a room run from the Esc menu leaves the room and lands in the hub. Retry still opens the Sima entry card.
  - The Sima's "Modo" row: the lobby window is gone, so the host now picks the mode where it enters: `TownLobby.variants` gives the Sima two Enter rows, "Entrar · Reto diario" and "Entrar · Libre", in the crater mouth's window and in the waystone list (`enterRows` in `src/town/lobby.ts`, pure, tested); `depart(id, variant)` turns it into `endlessSeed(mode, today, room seed)` for `session.begin`. Guests and solo play keep the single Enter row (solo still gets the entry card after the loadout).
  - `src/data/world.ts`: `SIMA_DUNGEON_ID` is now `ECLIPSE.id` from the registry (`eclipse-chasm`), so the crater opens the Sima; test "the crater's mouth is the Sima del Eclipse of the registry, open from the start".
  - i18n: both tail blocks (559 keys, no duplicates); `docs/gdd.md`: both sections, the crater no longer "sealed", co-op mode picked at the mouth or the waystone, end of run back to the hub or the room's town; `README.md`: main's paragraph plus the overworld's waystone and `&guest=1` edits, crater open, mode rows in the room paragraph.
- Fix found while merging (`0b887d3`): a guest's unread Sima clock survived `reopenLobby`/`onLobby`, so the next round from the town could start on the last round's 0:00. `resetRun` now clears it. RED first (`expected { ms: 0, floor: 12 } to be null`), then GREEN.
- Lore: `tests/town/world.test.ts` pins that losing on the Crypt's floor 6 (or to Sableye on 3) adds no lore line and beating Aegislash on 6 does.
- Records/leaderboard keys untouched (`mazmorra-sombria.records`, the leaderboard key and the save are as on main).
- Checks: `npm test` 105 files / 1015 tests passed; `npm run build` ok.

### S3 Screenshots
Own dev server (port 4561) and headless Firefox (BiDi 9461, own profile whose `user.js` has `user_pref("media.volume_scale", "0.0");`), settings `muted: true` written to localStorage before every page load (read back `true` in every shot and both duo windows). Scripts: `/tmp/integrate-crypt-world/shot.mjs`, `duo2.mjs`, `pick.ts` (seed finder). Both processes killed by PID afterwards.
- `crater-entrance.png`: the crater mouth opens "¿Entrar en Sima del Eclipse?"; `crater-to-sima-card.png` (text): Enter, then the loadout, then the Sima's entry card.
- `crypt-floor3-sableye.png`: Crypt floor 3, Sableye's Glint lane, the steal line in the log, the 16-bit battle theme.
- `sima-floor6-pawniard-golett.png` (1280x800, free run seed 3818): Golett, Pawniard and Pumpkaboo in the next room, clock 7:55.
- `lobby-two-players-host.png` / `-guest.png`: "Anfitriona" and "Fran" walking the hub together, room window.
- `lobby-waystone-sima-modes.png`: the host's waystone lists "Sima del Eclipse · Reto diario" and "· Libre".
- `room-run-*.png`, `room-end-*.png`: the host picked Libre; both ran seed 3818; the dev clock (6 s) ran out; both end screens list the party "Anfitriona, Fran" and "Volver al pueblo".
- `room-back-in-town-*.png`: after the host's "Volver al pueblo" both are back in the room's town (room window, both players listed).
- `solo-end-screen.png` then `solo-end-back-to-hub.png`: a solo defeat, "Volver al pueblo", the hub without a room window.
- Seen, not fixed (pre-existing in the overworld branch): after a round both walkers reappear on the hub spawn, so their names overlap until someone moves.

## Next step
Parent: review, then decide delivery (push/PR stay with the user).
