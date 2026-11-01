# Pixelfx effects

Objective: prettier attacks, crystals and world effects from pixelfx, super light for the web game. Branch: `feat/pixelfx-vfx`.
Delivery: `ask-on-risk`, work-unit commits, push and PR are the owner's call. Test runner: `npx vitest run --testTimeout=30000`.

## Specs

- S1: "vamos a hacer que los ataques se vean mas bonitos!": every player move, enemy attack and boss attack shows a pixelfx effect, solo and co-op.
- S2: "coge primero de la pokeapi lo que necesites y si en la pokeapi no te convence lo que necesitas tienes esto": PokeAPI first, then pixelfx. Finding: PokeAPI has no move visuals.
- S3: "si podemos coger los recursos de pokemon mundo misterioso DX por ejemplo seria genial pero si no pues nos los inventamos": ripped DX assets only if allowed. Decision: not allowed (no licence, public repo), see Log L3.
- S4: "usalo tambien para los cristales y otras cosas! con esto esque podemos dejar muy bonito el juego": crystals and other world objects get effects too.
- S5: "hay que hacer algo que sea super ligero para el juego web! investiga como otra gente lo soluciona!": no image download, main thread cost per frame stays a `drawImage` per effect, memory capped.
- Assumption: enemy hitboxes and telegraphs stay readable; effects never hide a fairness cue.
- Assumption: core stays untouched, so golden digest and balance stay byte-identical.

## Tasks

- T1 (S5) inline, no writer reason: vendored library, worker bake, store with memory cap, live effect system. Status: in progress.
- T2 (S1) inline: all player moves, impacts, solo and co-op.
- T3 (S1) inline: enemy and boss attacks, guests derive from snapshots.
- T4 (S4) inline: crystals, pickups, chests, deaths, status, bonfire, stairs and other world objects.
- T5 (S1-S5) inline: credits, GDD, perf measure, deploy gate.

## Parity checklist

- [ ] Every entry of `MOVES` (base, tutor, line) resolves to an effect (test iterates)
- [ ] Every `PokemonType` has an impact and a projectile look (test iterates)
- [ ] Every enemy behaviour kind and boss (`ENEMY_BEHAVIOUR`) shows a strike effect
- [ ] All dungeons: main, challenges, Sima/endless, shrine
- [ ] Solo, host, guest (remote players' moves and hits, enemy attacks on guests)
- [ ] Time crystal, cave and swamp crystals, treasure, chest, berry, memory, stairs, exit, bonfire, altar, nest
- [ ] Status: burn, poison, mark, weakened; roll dust; level up; boss phase; enemy and player death
- [ ] Town embers and DOM screens (evolve, gacha): reviewed
- [ ] i18n: no player-facing text expected, confirm
- [ ] Save/migrate/sanitize, net protocol: no change expected, confirm
- [ ] GDD, CREDITS, sim/prove unaffected

## Log

- L1 (2026-11-01): "https://github.com/patch-gg/pixelfx?utm_source=chatgpt.com vamos a hacer que los ataques se vean mas bonitos! coge primero de la pokeapi lo que necesites y si en la pokeapi no te convence lo que necesitas tienes esto!!! esque si podemos coger los recursos de pokemon mundo misterioso DX por ejemplo seria genial pero si no pues nos los inventamos :v o si el ataque no encaja con nuestra version de el!"
- L2 (2026-11-01): "usalo tambien para los cristales y otras cosas! con esto esque podemos dejar muy bonito el juego"; "claro hay que hacer algo que sea super ligero para el juego web! investiga como otra gente lo soluciona!"
- L3: Measured 18 effects on desktop. 30 fps sheets 7.3 MB and 61 MB decoded; 12 fps trimmed 2.8 MB and 12.8 MB; live simulation 0.13-2.1 ms per effect per frame; code only 62 KB gzip, baking 2-173 ms per effect once. Chosen: vendored code, baked once in a worker per effect and palette, drawn with `drawImage`, hand-drawn effects as fallback. DX, PokeRogue and RawAsset assets rejected: no licence declared and a public repo is a DMCA target (`docs/legal-risk-notes.md`).
