---
name: pixel-craft
description: "Trigger: backdrop, scenery, town scene, sprite placement, pixel icon, pixel art, fondo, casas, iconos. Draw game art at cobbleverse craft, prerendered and light."
license: Apache-2.0
metadata:
  author: "alvaroofernaandez"
  version: "1.0"
---

## Activation Contract

Load before drawing or changing any backdrop, scene prop, Pokémon placement in a scene, pixel icon or pixel UI ornament in Mazmorra Sombría.

## Hard Rules

- Draw on a cell grid with palette keys (`src/ui/pixel-grid.ts` `Grid`): one cell is one buffer pixel; never free hex colours in props, add keys to the scene palette.
- Static art is prerendered once per canvas size (`src/ui/dusk-haven.ts` `buildHaven`); per frame draw only lights, fx, sprites, sky motion (`src/ui/eclipse.ts`). Budget: ≤ 3 full-layer `drawImage`, glows from cached sprites, no per-frame gradients over the whole canvas.
- Light comes from the eclipse behind and above the centre: red rim (`rim`/`rimD`) on edges facing it, shade on the far side; warm amber from windows and lamps, returned as `Light` objects, never baked glows.
- Every Pokémon in a scene is a real sheet sprite (Idle/Walk, 8 PMD rows), stands on a surface by its anchor, has a contact shadow, and keeps to a prop from the lore (`HAVEN_PROPS` + `prop` in `src/ui/town-walkers.ts`, tested). Never hand-draw Pokémon.
- Pixel icons: 16×16, outline `#140c11`, 3–8 colours, top-left highlight, original art only (`src/ui/pixel-icons.ts` style; area maps drawn with `pixelSvgOf`).
- Buffer ≈ 300 px tall at any window size, whole-number upscale, `image-rendering: pixelated`.
- Patterns only from references; no assets from other games.

## Decision Gates

| Need | Do |
|---|---|
| New building or prop | Compose `cottage`/`gable`/`windowPane`/`darkTree` style helpers; return `{ lights, smoke }` |
| Something moves | Per-frame code in `eclipse.ts`, pure-of-time where possible (testable) |
| A new resident | Add to `TOWN_RESIDENTS` with `prop`, area in front of it; tests must pass |
| New icon set for a screen | Own module `src/ui/icons/<area>-icons.ts` + a test iterating it |

## Execution Steps

1. Read `references/craft.md` and the cobbleverse sources it lists for the piece you draw.
2. Write the failing test first (layout, palette, placement).
3. Draw static art into the prerendered layer; lights/fx per frame.
4. Screenshot at 1440×900 and 844×390 with Playwright and iterate until it reads at a glance.
5. Measure frame cost if you added per-frame work (no long tasks > 8 ms).

## Output Contract

Report files, tests (RED then GREEN), screenshot paths and any per-frame cost added.

## References

- `references/craft.md` — palette roles, detail checklist, performance budget, cobbleverse source map.
