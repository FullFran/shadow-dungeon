# Mazmorra Sombría

Non-commercial Pokémon fan game prototype: top-down, souls-like real-time combat with Mystery Dungeon-style sprites. The design lives in [`docs/gdd.md`](docs/gdd.md) (Spanish).

Current milestone: **M0**, a playable combat demo: a sandbox room with three Poochyena and two Gastly, then a boss fight against Aegislash. It runs entirely in the browser (no accounts, no backend; only your menu settings are kept in `localStorage`).

**Play:** https://www.fullfran.com/shadow-dungeon/

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

Open the play link (or `npm run dev` locally), pick Mimikyu's fast and heavy moves, the language and whether click-to-lock is on in the menu (remembered in `localStorage`), then press Start. A run is three procedurally generated floors (rooms and corridors, sleeping Poochyena and Gastly that wake when you come into their room or into sight) and a fourth floor against Aegislash; step on the stairs to go down, no need to clear the floor. HP carries over (each new floor heals 25%), Disguise comes back on every floor. Floors 2 and 3 may be **collapse floors** (25% and 40%): after a short grace the ceiling falls from the entrance towards the stairs along the walking distance, rubble hurts and pushes you, and escaping shows your time on the next floor's card. Every floor opens with a title card ("Floor 2"), and a Mystery Dungeon-style minimap (top right, Tab to hide) reveals rooms and corridors as you see them; awake enemies chase you around walls. Losing all HP shows the defeat screen; beating Aegislash shows the victory screen; both show the floor reached and the run seed. Add `?seed=123` to the URL to replay a seed (the same seed gives the same floors and the same collapses); on the dev server `?floor=2` also starts on that floor.

| Input | Action |
|---|---|
| WASD | Move |
| Space | Roll (i-frames, costs stamina); roll through a hit at the last moment for a perfect dodge |
| Left click / Q | Fast move (Shadow Claw or Shadow Sneak) |
| Right click / E | Heavy move (Play Rough or Shadow Ball), hold to charge |
| Aim | With no lock, a click attacks towards the cursor and Q/E along your facing (last WASD direction; steer an E charge with WASD). With a lock, every attack aims at the target. If the button and its key are both held, the mouse wins |
| Shift / middle mouse button | Lock-on on the enemy nearest the cursor. Lock type (menu): *press to lock or release* (default), *hold to lock*, *click only* (Shift and middle mouse do nothing) or *off* |
| Left click on an enemy | Click-to-lock (on by default, toggle in the menu; with *click only* it is always on, with *off* never): locks onto that enemy, or switches to it, and still attacks; a faint ring marks the enemy under the cursor. Clicking the ground keeps the current lock (with *click only* it releases it) |
| Mouse wheel | Switch locked target clockwise / counter-clockwise |
| Tab | Show or hide the minimap |
| M | Mute or unmute sound |
| Esc | Menu: resume, quick settings (lock type, click-to-lock, volume, mute, language), restart floor, quit to the main menu. The solo demo pauses while it is open |

Moving the mouse never changes the locked target; only the gestures above do.

Aegislash blocks hits from the front in Shield Forme (the blue arc): flank it. In Blade Forme it attacks in combos and stays open afterwards.

### Online rooms (netcode spike)

"Play online" in the main menu: **Create room** makes a 5-character code (no 0/O or 1/I/L) and shows it big with a copy button; **Hide code** masks it for streamers. Friends type it under **Join** (or open the page with `?room=CODE` to prefill it). Up to 4 players; a fifth is told the room is full. The host sees who is in the room and presses **Start**; everyone plays the host's seed. Peers find each other through public Nostr relays ([Trystero](https://github.com/dmotz/trystero) 0.26, default strategy) and then talk browser to browser over WebRTC. No TURN server is configured, so two players behind strict NATs may not connect. Trystero loads only when you open a room, never in solo play. `?lag=`, `?jitter=`, `?loss=` and `?delay=` work here too. In a shared run, **F3** shows the net stats overlay: role, players connected, round trip per player, snapshots per second and their age (guest), and bytes per second out and in.

### Two tabs together (netcode spike)

Open the game with `?net=local` in two or more windows of the same browser (up to 4 players) and press Start in each: the first one (or the one with `?host=1`) hosts and the others join it; everyone plays the host's seed. Each tab simulates its own player with no wait, the host runs the enemies, and an enemy attack only hurts you if it touches you on your own screen. Remote players show as "P2", "P3"... with an HP bar; a fainted one stays down (no revive yet). The host's stairs take everyone down. `?lag=150&jitter=30&loss=0.05` simulates a bad network on what that tab sends, and `?delay=100` tunes how far in the past remote players and enemies are drawn. Tabs opened at the same instant agree on one host (the lowest random id). Remote players' projectiles are drawn on every screen. If the host closes, guests get "The host left" and a button back to the menu. A perfect dodge in a shared run gives the dodger the flash and sound but never slows the enemies for anyone. Use separate windows side by side: a browser stops animating a hidden tab, and a hidden host stops the run.

## Sound

All audio is procedural Web Audio (`src/adapters/audio.ts`), with no sound files: short retro effects synthesised from oscillators, noise and filters, mapped from the core's `GameEvent`s (a pure `soundFor(event)`), throttled per sound and capped in simultaneous voices. The music is an original looping chiptune in A minor (square lead, triangle bass, noise drums; patterns in `src/data/audio.ts`) played by a lookahead scheduler on the AudioContext clock; the boss room switches to a faster, busier variant and the music fades out on the end screens. Sound starts on the first click or key press, since browsers block autoplay. The menu has master, music and effects volume sliders and a mute checkbox (remembered with the other settings); `M` toggles mute in game.

## Layout

| Path | What |
|---|---|
| `src/core` | Pure, deterministic simulation (no DOM, no adapters; compiled without DOM typings) |
| `src/data` | Typed game data: species, moves, type chart, sprite meta |
| `src/adapters` | Rendering, input, assets, audio, storage |
| `src/net` | Netcode spike: protocol, interpolation buffer, transports (BroadcastChannel, lag simulator), peer session |
| `src/app` | Bootstrap and wiring |
| `src/i18n` | `es.json` (default) and `en.json` |

## Legal

Non-commercial fan project. Pokémon and its characters belong to Nintendo, Creatures Inc., GAME FREAK and The Pokémon Company. Sprites come from [PMDCollab SpriteCollab](https://github.com/PMDCollab/SpriteCollab) under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/); per-artist credits are in [`CREDITS.md`](CREDITS.md).
