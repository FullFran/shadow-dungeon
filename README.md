# Mazmorra Sombría

Non-commercial Pokémon fan game prototype: top-down, souls-like real-time combat with Mystery Dungeon-style sprites. The design lives in [`docs/gdd.md`](docs/gdd.md) (Spanish).

Current milestone: **M0**, a single-room combat sandbox.

## Commands

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (Vitest)
npm run typecheck  # app + DOM-free core
npm run build      # typecheck + production build to dist/
node tools/fetch-sprites.mjs   # re-download sprites and regenerate meta + CREDITS.md
```

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
