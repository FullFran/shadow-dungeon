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
- Assumption: the simulation stays untouched, so golden digest and balance stay byte-identical; only a snapshot field and Heat Wave's owner-approved hitbox differ.

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
- [x] Save/migrate/sanitize untouched. Net protocol: a player shot's optional trailing move id (L14)
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
- L9 (2026-11-01): "cortes furia tambien estaba guapo con la animacion de antes hummm en la web con todos los nuevos ponme el nuevo y el antiguo de cada uno para comparar porfa"; "con un pokemon de ejemplo por ejemplo con mimikyu"; "y porfavor xD revisa los de mundo misterioso para inspirarte en ellos para los nuevos porque algunos no tienen sentido ajjaja pero otros estan muy guapos". `tools/fx-gallery.html` now shows old and new side by side on Mimikyu. Looks reassigned by what each move does in the games; no per-move description of DX's animations was found, so that part is my reading, not DX reference. Owner decides move by move which keep the old look.
- L10: Throttled 6x in headless Chromium (software canvas, DPR 3, dev build, 12 enemies, fighting), two runs each: main frame p50 49.9 ms, render p50 9.9-10.0; effects frame p50 49.9-50.0 ms, render p50 9.7-10.1. No measurable cost; the slowness at that setting already exists on main. Public latency from this machine: sd-api about 47 ms connect, 220 ms total; site served by GitHub Pages, not the VPS. No SSH used.
- L11 (2026-11-01): "en el comparador ponme una forma de darte feedback jajaaj para decirte si me gusta mas la nueva o la antigua y ponerte comentario". Gallery cards vote Antes, Ahora or Ninguno with a comment; saved to reports/fx/feedback.json (gitignored) by a dev-only Vite plugin, with a copy in the browser.
- L12 (2026-11-01): owner's verdicts, 112 new, bonemerang old, phantom-force and earth-power neither. Verbatim: swords-dance "estaria mejor que saliesen espaditas girando para bufarse"; will-o-wisp "estaria mejor varios fuegos fatuos chiquitos alrededor"; shadow-force "es genial pero tiene que desaparecer el poquemon un momento y volver a aparecer! busca su mecanica en el mundo misterioso porque esto en la vida real estaria muy roto xD porque puede aparecerpor la espalda o algo ajaja no se"; heat-wave "onda ignea no deberia ser circular igual que las otras ondas? no se revisa"; giga-drain "genial, pero que vuelvan particulitas hacia el pokemon porque lo esta drenando para curarse!"; phantom-force "repetido y el de arriga estaba mas guapo"; solar-beam "me gusta! pero que primero cargue! y amarillo sol"; earth-power "este es como erupciones en el suelo hacia el enemigo busca referencias". Done: custom effects sword-orbit, wisp-orbit, drain-motes; vanish is visual only (no iframes, no teleport), also on Phantom Force and Dig; motes on every draining move; Heat Wave's hitbox is now a 360 ring (gameplay change: Mystery Dungeon wiki says it hits foes in the room). Solar Beam uses its existing 620 ms windup as the charge, no timing change.
- L13 (2026-11-01): "ostia es verdad!!!! golpe umbrio es un golpe y golpe fantasma es lo que tiene que desaparecer antes ;-: cambialos porfa perdon por liarte hazlos segun la descripcion no se si desaparece los dos o no". PokeAPI, es, both: "En el primer turno, desaparece. En el segundo, golpea al objetivo" (shadow-force) and "El usuario desaparece en el primer turno y ataca a su objetivo en el segundo" (phantom-force). Both keep the vanish, following the description the owner deferred to. Shadow Force keeps the blow; Phantom Force gets its own line art over its whole dash. Invulnerability while vanished not added: that is a balance call. A Mejora already gives both "invulnerable mientras golpea" (rank-effects IFRAMES), which covers the strike, not the windup.
- L14 (2026-11-01): "y deberiamos de tocar el protocolo para que se viese bien la verdad testeando que tradeoffs tiene clarlo". A player shot now carries its move id as an optional trailing field. Measured: +17 B per shot on a 58 B shot ("solar-beam"): state message 127 to 144 B with one shot, 239 to 290 B with three, 519 to 655 B with eight; at 20 Hz +0.33, +1.00, +2.66 KB/s to each peer. A numeric index would cost about 5 to 9 B per shot but breaks debugging and needs a shared table: rejected, the saving is under 2 KB/s in the worst case. An unknown id is dropped and the shot still arrives; an older peer ignores the field. PROTOCOL_VERSION not bumped: the change is compatible. Real Trystero smoke against this branch: both peers listed in 2.6 s. Not run: two browsers firing at each other.
- L15 (2026-11-01): "vale me gusta, el otro dia, con andres usaba el golpes furia muy repetidamente y laggeaba la partida puedes testear esas cosas? o ya lo solucionamos? mas movimientos pueden laggear la partida?". Not a frame-rate problem and not from these effects: it predates them. Measured with tools/hit-stutter.ts: fury-swipes froze the world 33% of the time (16.8 hits/s), bone-rush 34%; hitstop also stopped network sends, 150 ms of silence against a 100 ms render delay, and slowed the host's world. Fixed: co-op never stops the world for hitstop; multi-hit parts stop only on the last. A test walks every damaging move. Not verified with two real players.
