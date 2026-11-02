# Menu redesign

Objective: easy and pretty to start playing without losing the soulslike soul, for the next release. Branch: `feat/menu-redesign`.
Delivery: `ask-on-risk`, work-unit commits; push, PR and release are the owner's call. Test runner: `npx vitest run --testTimeout=30000`. Reference: Notion "Análisis UX · menús y primera partida", deck `~/fullfran/game-analysis/slides-menus/menus.pdf`.

## Specs

- S1: owner (from Álvaro): "arreglar los menus, que la gente lo tenga facil y bonito para jugar y demas para que esto pegue el pelotazo".
- S2: owner: "sin perder la esencia del juego de que sea como un soulslike!!! inspirate tambien en darksouls 3 o en nightreign!!!". Teach controls, not strategy; the game stays hard.
- S3: ticket SD-E7HAFY: "Mejorar legibildad de letras, inputs, tipografía en zonas de escritura". Ticket SD-D1ZBRQ: "Mejorar legibilidad textos, menú, hacer onboarding de las habilidades, de cómo se juega en combate, hacer una especie de tutorial, etc".
- S4: nothing overlaps or overflows at 844x390 landscape and 1280x720 (the fan notice over the title hints and the loadout, found 2026-11-02).
- S5: hints match the device: no keyboard keys shown to touch players.
- S6: grouped town menu and settings in tabs with one sentence per option (deck "qué copiar" 3, 8).
- S7: first run reaches combat in few steps, with a playable tutorial in the Crypt's first floor (deck propuesta 1). Owner: "si, saltamos y lo llevamos directo a la cripta. me encanta que sea souls": the first run goes from the starter choice straight into the Crypt; the town opens after the first guardian. Still open: default difficulty, floor messages as Caminantes.
- S10: owner: "podemos hacer que dejen otros camninantes mensajes?!!! por ahora carteles neutros porque esto se puede descontrolar xD y ademas es procedural": tutorial signs are neutral for now; messages left by other Caminantes (players) stay PENDING as a future idea (moderation, anchoring on procedural floors).
- S8: owner: "el menu del pueblo al pulsar esc se puede hacer que se vea como un minimapa moviendote entre los distintos npc para usar su menu!!! y que sea mas visual y reconocible a parte de tener interfaz en la web a parte del pueblo... inspirate tambien engenshin impact y demas de hoyoverse podemos tener el menu circular con tab y todas esas cosas": Esc in town opens a map of the town where the cursor jumps between NPCs and places to open their service; the same services stay reachable outside the town; a radial quick menu on Tab. Patterns only, no assets from those games.
- S9: inspiration split approved by the owner ("me encaja las inspiraciones, luego antes de publicar revisamos y hacemos cambios"): souls for tone and structure (sober dark menus, the town map as an inked plan, a discreet quick wheel), Touhou for difficulty cards (Easy/Normal/Hard/Lunatic style with a line and best mark), the Santuario as spell practice, spell-card declarations and the gallery as a music room; PokéIsaac/PokéSurvivor only for accessibility. Owner reviews everything before publishing. Map and wheel icons are original glyphs, no assets from other games.
- Assumption: Pixelify Sans stays for titles, buttons and the HUD; a legible OFL body font is added for body text and inputs.

## Tasks

- T1 (S3) inline: Atkinson Hyperlegible (OFL) for paragraphs, list items, descriptions and inputs; Pixelify Sans stays for titles, menu rows and HUD (`index.html`, `src/ui/tokens.ts`, CREDITS). Status: done, seen on the local Settings screen.
- T2 (S4) inline: the fan notice is the last row of every menu screen (static, screen centred above it); runs keep the small fixed one. Status: done, title checked at 844x390; loadout not re-captured yet.
- T3 (S5) inline: touch variants for title, town talk/read/travel, room hint, prologue skip and item pick (`isTouchUi()`, es/en). Status: done for those; remaining key-named hints (leave.hint, shop/tutor/evolve Enter hints, sima.shrine.hint, town.beacon.room) pending.
- T4 (S6, S8) inline: town map menu (Esc) jumping between NPCs, plus a radial quick menu on Tab; services reachable outside the town. Status: map done (`src/town/town-map.ts` pure markers + direction step, RED by missing module then GREEN 6 tests; `src/town/town-map-view.ts` inked plan from `buildTownGrid`, original SVG line glyphs, column for services with no place and the exit rows; seen at 1280x720 and 844x390). Quick wheel done in town: hold Tab, point with mouse/arrows/stick, release opens (`src/town/quick-wheel.ts` 8 services + `wheelSector`, RED by missing module then GREEN 4 tests; `quick-wheel-view.ts`; seen at 1280x720, release on a sector opened its window). Pending: the wheel outside the town (Tab is the minimap in runs: needs an owner call), touch access to the wheel, a real gamepad try.
- T5 (S6) inline: Settings screen in tabs (General with the profile rows, Fijar objetivo, Sonido, Accesibilidad, Táctil; Q/E or tap) and one sentence per option in the shared description box (`settingTabs`, `SettingRow.about`, `setting.*.about` es/en). RED observed (2 tests), GREEN; seen locally (E twice reaches Sonido, the sentence follows the cursor). The pause menu keeps its flat list. Status: done.
- T6 (S1, S7) inline: first run goes from the starter choice straight into the Crypt (`nextPlayScreen` 'crypt', `townOpen` in adventure-route.ts: Crypt cleared or town traces in the save so earlier players keep the town); solo end screen and pause quit go to the title until the town opens. RED observed (3 tests), GREEN, seen locally (fresh profile lands on Crypt floor 1). Status: route done; big play button pending.
- T8 (S6) inline: pleas redesign: villagers already gathered on the rim, each steps forward with one name (10 lines instead of 22, each still asks please), Phantump asks and the player answers (`PLEA_ANSWERS` promise/silent, reply line, Esc = silence); quicker step (110 px/s). RED observed (3 tests), GREEN 6. Browser: the dev `?screen=town` route does not play the pleas (start window), so the full scene was not seen in a browser yet. Status: done in code and tests; owner review before release.
- T7 (S2, S3, S7, S10) inline: contextual tutorial in the Crypt: neutral stone signs the first time each thing happens on this device (move+roll and attack on floor 1, roll on the first hit, stamina on a refused roll, charge on the first heavy move, lock on the first quick move, bonfire when lit), keys/touch/pad wording (`src/app/tutorial.ts` pure + seen store `mazmorra-sombria.tutorialSeen`; `game.ts` teach/tickSign reading the step's events, no change to the simulation; one sign at a time, 7 s, never over the floor 1 title). RED by missing module then GREEN 6 tests; seen locally on a fresh profile (first sign after the floor title). A first wiring put the option inside the Sima-only spread, caught by the browser check and fixed. Status: done; pad wording not tried on a real pad.

## Parity checklist

- [ ] Every menu screen (title, options, settings, account, town menu, loadout, shop, tutor, gacha, board, shrine, gallery, credits, lobby, end screen, pause) checked at 844x390 and 1280x720
- [ ] Touch, keyboard and gamepad hints for every hint line
- [ ] Solo and co-op (lobby, room rows in the town menu)
- [ ] i18n es/en for every new string
- [ ] GDD, CREDITS (new font), prove

## Log

- L1 (2026-11-02): "sigue con el rediseño del menu! y las 3 cosas." Previous: "he estado hablando con alvaro y me ha dicho que sobretodo tenemos que: arreglar los menus, que la gente lo tenga facil y bonito para jugar..."
- L2: co-op ticket SD-RIKZIZ handed to a worker on `fix/coop-leave-room` (separate surface).
- L3 (2026-11-02): "si, saltamos y lo llevamos directo a la cripta. me encanta que sea souls siiiiiiiii me encanta xD a y el menu del pueblo al pulsar esc se puede hacer que se vea como un minimapa moviendote entre los distintos npc para usar su menu!!! y que sea mas visual y reconocible a parte de tener interfaz en la web a parte del pueblo... inspirate tambien engenshin impact y demas de hoyoverse podemos tener el menu circular con tab y todas esas cosas"
- L4: co-op SD-RIKZIZ fixed on `fix/coop-leave-room` 0cde71f (worker), independent verifier running.
- L5 (2026-11-02): "y me encaja las inspiraciones, luego antes de publicar revisamos y hacemos cambios"
- L6: verifier on SD-RIKZIZ confirmed both claims, found B1 (held guest never told the host left); fixed with RED/GREEN in 5ceac86 on `fix/coop-leave-room`, full suite 4359 green.
- L7 (2026-11-02): "ostia, va duro de cojones jajajaja, podemos hacer que dejen otros camninantes mensajes?!!! por ahora carteles neutros porque esto se puede descontrolar xD y ademas es procedural"
- L8: title and prologue touch hints were hidden by `html.touch .hint`; fixed with dual wording in 46eab51 (found by the deck worker).
