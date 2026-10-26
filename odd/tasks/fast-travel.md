# Fast travel and the town-first menus

## Objective

Owner (2026-10-26): "Andar hasta Phantump es un coñazo, tiene que haber forma de teletransportarse." Then: "Rediseña el menú inicial: tiene que haber muy pocos botones. Jugar, que te lleve al pueblo; Jugar en línea, que creas sala o te unes y al pueblo; y lo demás (ajustes y todo eso). El pueblo es la interfaz para todo. Y desde el pueblo, menú de Esc para acceso rápido a las cosas que hay en el pueblo o volver al inicio."

## Problem

Reaching a service (Phantump at the Black Lake, three maps east) means walking the overworld every time. The title screen lists ten entries that duplicate what the town already holds.

## Why

The town is the interface for everything; the title only starts play.

## Scope

- T1 Fast travel: a waystone (signpost art) on every overworld map; the "Viajar" window (shared described menu, fixed geometry) lists the maps visited on this device with what is there, plus a Phantump shortcut; choosing one fades and lands at that map's waystone (or beside Phantump). The hub's waystone keeps its dungeon list and gains a "Viajar" row.
- T2 Title and town menu: title with exactly Jugar / Jugar en línea / Opciones (a submenu with everything else); the town's Esc menu (and a touch button) with quick access to every town service and "Volver al inicio"; "Viajar" lives there too (town only, never in runs).

## Constraints

- Visited maps are a per-device flag (`mazmorra-sombria.visitedMaps`), not a save field, so `src/app/profile-merge.ts` is untouched.
- Co-op room town: each player travels alone; presence already carries `map` and the session's walker buffer jumps on a map change (src/net/session.ts), so `PROTOCOL_VERSION` stays 4.
- Keep changes small: another branch (feat/sima-lore) edits town dialogue and world texts.

## Tasks

- [x] T1 Fast travel (route: inline; one writer thread, the parent is this worker). Evidence: tests/town/travel.test.ts, menu-geometry `travel` stable at 1280x800, 844x390, 390x844.
- [ ] T2 Title menu and town Esc menu.

## Parity checklist

- [x] Every overworld map in `WORLD` has a waystone (type-required `waystone` field; tests iterate `WORLD` and check signpost, reachable landing, no overlap).
- [x] Every visited map appears in the travel list in world order (test iterates `WORLD`).
- [x] Every service NPC (`opens`) and every dungeon entrance is described (test iterates every map's NPCs and entrances).
- [x] i18n es/en for every destination and detail line (test per language, no em dash, placeholders filled).
- [x] Co-op: per-player travel, presence map id verified, no protocol bump.
- [x] Persistence: device flag, not in `PROFILE_KEYS` (test).
- [x] No travel during runs: only `src/town/scene.ts` imports the travel module (test).
- [x] GDD (docs/gdd.md, El mundo).
- [x] Menu geometry: `travel` added to tools/mobile/menu-geometry.mjs.
- [ ] Title: exactly three entries (T2).
- [ ] Town Esc menu lists every town service (T2).

## Checks

`npm run typecheck`, `npx vitest run --testTimeout=30000 --maxWorkers=4`, `npm run build`, `npm run prove`, `node tools/mobile/menu-geometry.mjs --only=travel`.

## Progress

- T1 done; commit recorded below.
