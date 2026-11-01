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

- T1 (S5) inline, no writer reason: vendored library, worker bake, store with memory cap, live effect system. Status: done, commits 92b6154, 98122bc.
- T2 (S1) inline: all player moves, impacts, solo and co-op. Status: done, in the integration commit.
- T3 (S1) inline: enemy and boss attacks, guests derive from snapshots. Status: done, in the integration commit; not run in a real two-peer session.
- T4 (S4) inline: crystals, pickups, chests, deaths, status, bonfire, stairs and other world objects. Status: done except the pending items below.
- T5 (S1-S5) inline: credits, GDD, perf measure, deploy gate. Status: done.

## Parity checklist

- [x] Every entry of `MOVES` (base, tutor, line) resolves to an effect (tests/adapters/fx-bake.test.ts, fx-director.test.ts iterate)
- [x] Every `PokemonType` has an impact and a projectile look (test iterates)
- [x] Every enemy behaviour kind and boss (`ENEMY_BEHAVIOUR`) shows a strike effect (test iterates)
- [x] All dungeons: the director reads world state, nothing is per dungeon
- [~] Solo and host seen in the browser; guest covered by unit tests from snapshots, no real two-peer run yet
- [x] Time crystal, cave crystals, altar, memory, exit, bonfire, chest and crystal payout. Stairs keep their Mystery Dungeon look on the owner's call (L8)
- [ ] PENDING: swamp crystal spire, crypt treasure pile, berry, nest, merchant still hand-drawn
- [x] Status: burn and poison on enemies, poison on the player, roll dust, level up, boss stance, enemy death, summons
- [ ] PENDING: mark and weakened keep their hand-drawn marks; player death has no effect; herald blink has no event hook
- [ ] PENDING: enemy Bug, Ghost, Grass, Flying and Steel streak shots, spore clouds and roots keep their hand-drawn looks (they are readable fairness cues)
- [ ] PENDING: town embers and DOM screens (evolve, gacha, shiny sparkle) unchanged
- [x] i18n: no player-facing text added
- [x] Save/migrate/sanitize, net protocol: untouched, `src/core` and `src/net` not in the diff
- [x] GDD, CREDITS, prove

## Log

- L1 (2026-11-01): "https://github.com/patch-gg/pixelfx?utm_source=chatgpt.com vamos a hacer que los ataques se vean mas bonitos! coge primero de la pokeapi lo que necesites y si en la pokeapi no te convence lo que necesitas tienes esto!!! esque si podemos coger los recursos de pokemon mundo misterioso DX por ejemplo seria genial pero si no pues nos los inventamos :v o si el ataque no encaja con nuestra version de el!"
- L2 (2026-11-01): "usalo tambien para los cristales y otras cosas! con esto esque podemos dejar muy bonito el juego"; "claro hay que hacer algo que sea super ligero para el juego web! investiga como otra gente lo soluciona!"
- L3: Measured 18 effects on desktop. 30 fps sheets 7.3 MB and 61 MB decoded; 12 fps trimmed 2.8 MB and 12.8 MB; live simulation 0.13-2.1 ms per effect per frame; code only 62 KB gzip, baking 2-173 ms per effect once. Chosen: vendored code, baked once in a worker per effect and palette, drawn with `drawImage`, hand-drawn effects as fallback. DX, PokeRogue and RawAsset assets rejected: no licence declared and a public repo is a DMCA target (`docs/legal-risk-notes.md`).
- L4: Measured on this machine at phone viewport, crowd-12 scene: render p95 2.36 ms on main, 2.14 ms with effects; both within noise. Not measured on a real phone, and boss-card is not a valid comparison: it reports 0 bullets on main too. Main bundle grows 16 KB (5.5 KB gzip); worker 49 KB, each effect a lazy chunk. Every move and world look at once decodes to 24.1 MB; verifier's upper bound over every kind by every type is 273 looks and 85.7 MB, so eviction is a real path and works in the store test.
- L5: Rejected after looking: effects that paint pixelfx's human dummy (blink-in, curse, soul-rise, status/haste, cursed, slowed) and cartoon-pow's English "POW!" text.
- L6: Independent verifier found 3 blockers: `enterFloor` never reset the director (every enemy puffed on each descent), a guest's hit or kill undone by a late snapshot played twice, and remote shots lost `vel`. Also: move art covered telegraphs, and water-orb shrank under `fitHeight`. All fixed in one correction batch: moves now draw under the telegraphs, water uses plasma-shot.
- L7: Recheck on 8aa1790: all fixed. Known leftovers, not blockers: above about 300 ms RTT a guest's hit can spark twice; a predicted kill the host refuses plays its puff early and none at the real death. Enemy shots raised to 4.5x radius because the plasma body measured 6.5 px against a 12 px hitbox at 2.6x; not yet judged by the owner in play.
- L8 (2026-11-01): "las escaleras porfavor que sigan siendo las escaleras de antes del mundo misterioso jajaja que eso esque es iconico xD". Stairs effect removed, pinned by a test.
