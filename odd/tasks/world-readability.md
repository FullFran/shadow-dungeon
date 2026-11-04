# Bigger creatures, interaction tooltip, dialogue box, bigger hints

Owner (2026-11-04): "Haz los pokemon también más grandes, ahora mismo están demasiado pequeños"; "cuando haya que interactuar, que salga como tooltip cerca de lo que vas a hacer, mejor rediseñado"; "rediseña también los diálogos"; "más grande las ayudas visuales".
Branch: `feat/title-hub`. Runner: `npx vitest run --testTimeout=30000`. Design contract: `.agents/DESIGN.md` §4 (Creature scale, World tooltip, Dialogue box, Hint bar).

## Tasks

- T1 creature scale: `src/adapters/creature-scale.ts` (`CREATURE_SCALE = 1.5`, `creatureRect`, `drawCreatureFrame`, `withCreatureScale`) used by `src/adapters/renderer.ts` and `src/town/render.ts`. RED: `tests/adapters/creature-scale.test.ts`.
- T2 hint bar: `hintSizes`, `interactGlyphs`, no interact chip, two rows before labels step back. RED: `tests/ui/play-hints-model.test.ts`.
- T3 world tooltip: `src/ui/world-tooltip-model.ts` (`interactKind`, `placeTooltip`), DOM `src/ui/world-tooltip.ts`. RED: `tests/ui/world-tooltip-model.test.ts`.
- T4 dialogue box: `dialogueView` and instant reveal in `src/town/dialog.ts`, sources in `src/town/dialogue-sources.ts`, DOM `src/ui/dialogue-box.ts`. RED: `tests/town/dialogue-model.test.ts`.
- T5 docs: DESIGN.md §4 and §8, GDD (view and hints paragraph).

## Parity checklist

- [x] Creatures: dungeon renderer (player, remote players, enemies, bosses, stitch clones, figurations) and town renderer (player, partners, villagers, wanderers, co-op walkers, plea crowd, tour guide) draw through `creature-scale` (test scans both files; test iterates every species, shiny/female sheet and shrine boss)
- [x] Gameplay unchanged: hitboxes, lock-on, AI, telegraphs and net state never read the scale (`npm run prove` and the sim digest results in the closing report)
- [x] Shadows, name tags, rings, marks and status icons scale with `withCreatureScale`; herald/wound factors multiply it (bosses keep relative size)
- [x] Cinematics (prologue, guardian, herald, sima scenes) draw their own staged art and are not world draw paths: unchanged on purpose
- [x] Interaction kinds: every NPC of every map (`WORLD`), the board, lore points, waystone, shrine and beacon have a verb with es and en labels (test iterates `WORLD`)
- [x] Dungeons: there is no interact action inside a run (bonfire, memory and exits are walked into), so no tooltip there; the hint bar follows the new sizes in runs and the town
- [x] Dialogue sources: every NPC (and resident after/revealed lines), lore point, plea villager and reply, tour guide, shrine, beacon, board and lobby message renders in es and en (test iterates the data)
- [x] Touch: tooltip is a 52 px button, the old "Hablar" button is hidden, the box advances on tap
- [x] Reduced motion: no tooltip rise, no typewriter, no arrow bob, no hint fade
- [x] i18n es and en: `interact.*`, `dialogue.*`; obsolete `town.talk*`, `town.read*`, `world.travel*`, `hint.talk|read|travel` removed
- [x] GDD and DESIGN.md updated
- [ ] Pending (not cut): inline dialogue choices (none exist today: the oracle's answer is a window); a Playwright check on a real phone with a gamepad
