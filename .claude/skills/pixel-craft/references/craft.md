# Pixel craft: details

## Cobbleverse sources (patterns to port, not assets)
- `/Users/alvaroofernaandez/Proyectos/server/cobbleverse-platform/web/scripts/lib/pixel-kit.mjs` — Grid, palette keys, gridSvg.
- `.../web/scripts/lib/pixel-village.mjs` — cottage (timber frame, braces, storeys), gable (tile courses, lit tiles on one half), windowPane (mullion, hot pane, flower box), shop (awning, sign, goods), lampPost, tree (stacked ellipses, bites out of the edge), cobbles, chimneySmoke, fireflies, swingLantern.
- `.../web/scripts/lib/scenery-fx.mjs`, `backdrop-fx.mjs` — fx as separate layers; only transform/opacity animate.
- `.../web/DESIGN.md` §"calm, animated page backdrops", §"every Pokémon stands on something" (perches, contact shadows), §"the landing is one village" (performance: no full-window cross-fades).

## Detail checklist for a building
Wall with a shade band away from the eclipse, rim on the facing corner; frame beams or stone courses; stone footing with a lit top line; tiled gable with alternating courses, rim on the facing slope, ridge tiles lit; chimney with cap and a smoke point; door with lamp (a Light); mullioned windows, some dark, some curtained; optional sign, awning, flower box.

## Palette roles (`HAVEN_PAL` in `src/ui/dusk-haven.ts`)
base / L (lit) / D (shade) triplets per material; `rim`, `rimD` eclipse light; `gl`, `glH`, `glD` lamplit glass; accents per service: violet gacha, forge fire, teal waystone rune.

## Performance budget
- Rebuild static layers only on resize.
- Per frame: sky blit, twinkles (≤ 30 rects), corona + rays, land blit, lights (cached glow sprites, `lighter`), smoke puffs, ≤ 10 sprites, fog strip blit, embers (≤ 60 rects), vignette blit.
- Reduced motion: hold the scene (one update per second).
