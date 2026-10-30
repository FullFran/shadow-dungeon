# Pokémon gender

Objective: a cosmetic, selectable gender per line, for the species with female art, seen in solo, town and co-op. Branch `feat/pokemon-gender`. Delivery: `ask-on-risk`. Runners: `npx vitest run --testTimeout=30000`, real browser with `tools/mobile/bidi.mjs`.

## Specs

- S1 Gender is cosmetic only: no rule in the simulation reads it, only the sprite choice. Follow how the shiny skin works (`src/core/shiny.ts`, comment there).
- S2 Selectable in the Pokémon screen (`src/app/loadout.ts`, next to the shiny row, same on/off or two-value row style), shown ONLY for species that have female art. Default male. It is saved per line in the save, like `shinies`/`shinyWorn` (`src/app/save.ts` sanitize, `src/core/collection.ts`, cloud profile travels with the save). Optional fields only, no save version bump, unknown or malformed values are dropped by sanitize.
- S3 Species with female art today, verified in SpriteCollab on 2026-10-30: shinx, luxio, luxray. Remote folders: normal `sprite/0403/0000/0000/0002`, and 0404, 0405 likewise; shiny female `sprite/0403/0000/0001/0002` is listed in the tracker but the files were NOT verified: check them with `tools/fetch-sprites.mjs`' fetching. If the shiny female files do not exist, a shiny female falls back to the normal shiny sheet, and say so. Alakazam's female folder 404s, do not add it. Keep the list as data, so Eevee, Combusken and Blaziken (issue #33, not playable yet) can join later by adding entries.
- S4 Sprites: extend `tools/fetch-sprites.mjs` (see `SHINY_TARGETS`, `remotePath`, `localKey`) with female targets, download only those (an `--add`/`--only` style flag, keeping the rest of `src/data/sprite-meta.json` and regenerating CREDITS.md as the tool does), and commit the resulting sheets under `public/sprites/`. The tool's existing behaviour for other flags must not change. Sheet type and key helper in `src/data/sprites.ts` next to `shinyKey`.
- S5 Every place that picks a player's sheet honours it: `playerSprite` in `src/adapters/sprite-anim.ts`, `playerSprite` in `src/town/scene.ts` (the local walker and other walkers), the loadout portrait in `src/app/loadout.ts`, evolving keeps it (it belongs to the line). Check `src/adapters/eclipse-echo-view.ts`, which copies a player's look.
- S6 Co-op: others see it, reusing the exact path of `shiny`: `src/net/protocol.ts` (hello, state; optional, outside the positional player array), `src/net/session.ts` (roster, `withSkin`, `repick`, `join`, walkers), `src/core/sync.ts` (snapshot, `remoteFrom`), `src/core/world.ts`, `src/app/game.ts`, `src/town/lobby.ts`, and every `repick`/`skinOn` call in `src/app/main.ts` (including `pokemonScreen`). Read how `src/net/version.ts` handles version mismatch; say whether protocol or content hash changes, and do not change `PROTOCOL_VERSION` unless existing tests or that file's rules require it. An older peer that sends no gender must read as male, not fail.
- S7 Do not change: keyboard, mouse, touch, controller input; balance; the recorded Easy game digest in `tests/core/difficulty-tiers.test.ts` must stay untouched (never re-record it).

## Tasks

- [x] T1 S3, S4 female targets in the fetch tool, sheets, meta, credits. Inline.
- [x] T2 S1, S2, S3, S5 `core/gender.ts`, save, sheet keys, adapters, town, loadout, i18n. Inline.
- [x] T3 S6 net path, world, game, lobby, main wiring. Inline.
- [ ] T4 S1, S5 real browser check, differential on the wire, GDD done; gate pending: `typecheck` and `build` fail until `females` is classified in `src/app/profile-merge.ts` (outside this writer's edit surface, see L6).

Route evidence: delegated by the parent as one bounded writer. Risk: none of items 1 to 5 expected; the save gains an optional field only, the wire gains optional fields only.

## Parity checklist

- [x] Playable species iterated by a test (`tests/adapters/gender-presentation.test.ts`, `tests/core/gender.test.ts`).
- [x] Shiny combination: male, female, shiny, shiny female, drawn in a real browser (L4).
- [x] Solo and co-op (`tests/net/gender-wire.test.ts`; two real peers not run in a browser).
- [x] Town: local walker in a real browser, other walkers by test.
- [x] Loadout: row and portraits in a real browser (L4).
- [x] Evolutions keep it (`evolveAt` test).
- [x] Save and sanitize. Cloud profile: pending the `profile-merge.ts` line (L6).
- [x] i18n es/en.
- [x] GDD.
- [x] CREDITS (regenerated; adds Morei, XModxGodX and others' female sheets).
- [ ] Pending, not dropped: cinematics (`adapters/sima-scenes.ts`, `adapters/story-scenes.ts`), the Eclipse Echo (copies the species only, as with shiny), the gacha reveal of a duplicate, a row in Phantump's window. All outside the specs' named places or surfaces; none draws the shiny in cinematics or the Echo either.

## Log

- L1 2026-10-30 owner: "tenemos que poner genero porque hdiferencias por genero!!!" / "genero de los pokemons!" / "solo aspecto y elegible y ademas hay pokemons que si tienen diferencias degeneros"
- L2 2026-10-30 shiny female files checked: `AnimData.xml`, `Idle-Anim.png` and `credits.txt` return 200 for 0403, 0404, 0405 at `0000/0002` and `0001/0002`; `--only=female` downloaded all six, no fallback needed. The sheets differ from the male ones byte for byte.
- L3 2026-10-30 RED seen: missing `core/gender` module; `expected '0403/0000' to be '0403/0000/0000/0002'`; `genderRow is not a function`; hello and state dropping `female`.
- L4 2026-10-30 real browser (`drawImage` recorded): male `0403/0000`, female `0403/0000/0000/0002`, shiny `0403/0000/0001`, shiny female `0403/0000/0001/0002`, each in the run, the town and the loadout. The row flips Macho to Hembra and saves `females: ["shinx"]`; Abra has no row.
- L5 2026-10-30 differential against the base commit: session hello, lobby and state wire for a player with no gender are byte identical, with and without shiny. `PROTOCOL_VERSION` stays 5 and `CONTENT_HASH` stays `1543ffd8`; a base build decodes a state with `fe` and a hello with `female` without failing, and shows that player as male.
- L6 2026-10-30 `SAVE_FIELD_RULES` in `src/app/profile-merge.ts` must classify every save field (it fails typecheck otherwise). Outside the writer's surface, so not edited: the needed line is `females: 'economy',`. With it, a scratch copy passes typecheck and build.
