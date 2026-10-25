# Mazmorra Sombría

Non-commercial Pokémon fan game prototype: top-down, souls-like real-time combat with Mystery Dungeon-style sprites. The design lives in [`docs/gdd.md`](docs/gdd.md) (Spanish).

Current milestone: **M0**, a playable combat demo: a sandbox room with three Poochyena and two Gastly, then a boss fight against Aegislash. It runs entirely in the browser (no accounts, no backend; only your menu settings are kept in `localStorage`).

**Play:** https://fullfran.github.io/shadow-dungeon/

This is a free, non-commercial fan game. Sprites are by the artists of [PMDCollab SpriteCollab](https://github.com/PMDCollab/SpriteCollab); see [`CREDITS.md`](CREDITS.md) and [Legal](#legal).

## Commands

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run typecheck  # app + DOM-free core
npm run build      # typecheck + production build to dist/
node tools/fetch-sprites.mjs   # re-download sprites and regenerate meta + CREDITS.md
```

Deploy: `.github/workflows/deploy.yml` runs the tests, builds `dist/` and publishes it to GitHub Pages on every push to `main` (or manually). Enable Pages with source "GitHub Actions" in the repository settings.

## How to play (M0)

Open the play link (or `npm run dev` locally), pick Mimikyu's fast and heavy moves, the language and whether click-to-lock is on in the menu (remembered in `localStorage`), then press Start. Clear the room (3 Poochyena, 2 Gastly) and walk through the east exit to fight Aegislash. Losing all HP shows the defeat screen; beating Aegislash shows the victory screen.

| Input | Action |
|---|---|
| WASD | Move |
| Space | Roll (i-frames, costs stamina); roll through a hit at the last moment for a perfect dodge |
| Left click / Q | Fast move (Shadow Claw or Shadow Sneak) |
| Right click / E | Heavy move (Play Rough or Shadow Ball), hold to charge |
| Shift / middle mouse button | Toggle lock-on: lock the enemy nearest the cursor, press again to release |
| Left click on an enemy | Click-to-lock (on by default, toggle in the menu): locks onto that enemy, or switches to it, and still attacks; a faint ring marks the enemy under the cursor. Clicking the ground keeps the current lock |
| Mouse wheel | Switch locked target clockwise / counter-clockwise |

Moving the mouse never changes the locked target; only the gestures above do.

Aegislash blocks hits from the front in Shield Forme (the blue arc): flank it. In Blade Forme it attacks in combos and stays open afterwards.

## Layout

| Path | What |
|---|---|
| `src/core` | Pure, deterministic simulation (no DOM, no adapters; compiled without DOM typings) |
| `src/data` | Typed game data: species, moves, type chart, sprite meta |
| `src/adapters` | Rendering, input, assets, audio, storage |
| `src/app` | Bootstrap and wiring |
| `src/i18n` | `es.json` (default) and `en.json` |

## Legal

Non-commercial fan project. Pokémon and its characters belong to Nintendo, Creatures Inc., GAME FREAK and The Pokémon Company. Sprites come from [PMDCollab SpriteCollab](https://github.com/PMDCollab/SpriteCollab) under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/); per-artist credits are in [`CREDITS.md`](CREDITS.md).
