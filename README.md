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

Open the play link (or `npm run dev` locally). The title screen (Play, Play online, Settings, Credits, Prologue, Town, Shop) and every other menu are Mystery Dungeon-style windows with a ▶ cursor: arrows or W/S move it, Enter or Space confirm, Esc goes back, and the mouse works too (hover moves the cursor, click confirms, the ◀ ▶ arrows of a setting change it). The first Play opens a skippable **prologue** cinematic (about 73 s; hold Esc/Enter or click "Skip"; the Prologue entry replays it), then a Mystery Dungeon-style **personality quiz** on a black screen: a voice asks "…Can you hear me?", then six of eight original questions (seeded by `?seed=`), and your nature decides your starter (Mimikyu, Zorua, Litwick or Cubone; accept it or pick one by hand); it becomes your species setting. Settings → Retake the test runs it again. Play then opens the loadout: pick your Pokémon (preselected with the quiz starter) (Mimikyu with Disguise, Zorua with Illusion, Litwick with Flash Fire or Cubone with Battle Armor; sprite, types and passive shown for the one under the cursor), then its fast and heavy moves (type, power and a short description on each card), then Start; the choice is remembered and also used in shared runs. Settings holds the language, the lock-on options and the volumes (all remembered in `localStorage`) next to the key list. A run is three procedurally generated floors (rooms and corridors, sleeping Poochyena and Gastly that wake when you come into their room or into sight) and a fourth floor against Aegislash; step on the stairs to go down, no need to clear the floor. HP carries over (each new floor heals 25%), Disguise comes back on every floor. Floors 2 and 3 may be **collapse floors** (25% and 40%): after a short grace the ceiling falls from the entrance towards the stairs along the walking distance, rubble hurts and pushes you, and escaping shows your time on the next floor's card. Every floor opens with a title card ("Floor 2"), and a Mystery Dungeon-style minimap (top right, Tab to hide) reveals rooms and corridors as you see them; awake enemies chase you around walls. **In-run progression** (all lost when the run ends): defeated enemies give experience (more on deeper floors) and each level adds max HP (healed at once) and damage; the HUD window at the top left reads "Floor 2 · Lv. 5 · HP 52/100" over the HP, stamina and XP bars, Disguise and your held items, and a message log at the bottom left shows the last few events (level up, item equipped, berry eaten, enemy fainted, Disguise broken, collapse warning) and fades them after a few seconds. On entering every floor after the first (boss floor included) you pick one of three **held items** (Choice Band, Leftovers, Quick Claw, Sitrus Berry, Scope Lens, Focus Sash, Shell Bell, Muscle Band, Expert Belt, Bright Powder, Wide Lens, Rocky Helmet), offered by rarity and seeded by run, floor and player; click a card or press 1/2/3. Solo pauses while you pick; a shared run keeps going (the cards sit at the bottom and clicking one never attacks). Items stack up to a cap per item and are listed with their effects in the Esc menu. Some rooms hold an **Oran Berry**: walk over it to heal 20 HP (seen berries show on the minimap). Beating Aegislash opens a second dungeon, the **Misty Forest** (eight floors: Phantump, Pumpkaboo, Foongus, Spinarak and Hoothoot, a Trevenant mid-boss on floor 4 and Decidueye on floor 8, whose three spell cards are named on screen), with its own urgent floor, **Niebla**: the fog closes in until you find the stairs. With more than one dungeon open, a dungeon select follows the loadout (the town exit lists them too); floor 1 opens with the dungeon's title and the playing track ("♪ title"). Losing all HP shows the defeat screen; beating a guardian shows the victory screen; both show the floor reached, the run seed, the level, the items held and the **Pokémonedas** earned (in either dungeon; Trevenant pays half a guardian). Add `?seed=123` to the URL to replay a seed (the same seed gives the same floors and the same collapses); on the dev server `?floor=2` also starts on that floor, `?dungeon=misty-forest` runs the forest without unlocking it, and `?screen=dungeons|loadout|quiz|prologue|settings|credits|online|lobby|victory|defeat|town|shop` opens that screen straight away (for screenshots; the lobby preview uses a tab-local channel, not Trystero).

**Town** (last entry of the title menu; `?screen=town` on the dev server): a small walkable hub under the eclipse, built from Ninja Adventure tiles (CC0); the title music keeps playing. Walk with WASD or the arrows; E, Enter or Space talks to the gacha stall (Mimikyu), the upgrade shop (Poochyena) and the storyteller (Gastly, who tells one piece of the legend per talk), or reads the notice board (this device's records: best crypt floor, runs, victories and best level, written at the end of every solo or hosted run); Esc closes a dialog or goes back to the title. The road out of the east edge opens the destination window (Crypt of the Sword King), which goes on exactly like Play (prologue and quiz first if they are still due, then the loadout). The gacha still says "Coming soon"; Poochyena opens the upgrade shop.

**Pokémonedas and the shop** (provisional numbers, docs/gdd.md §11): every run pays Poké Coins into a local save (`mazmorra-sombria.save`, versioned with `migrate()` and `sanitize()`), per floor cleared (by depth), per enemy defeated (more on deeper floors), for escaping a collapse quickly, for beating the guardian and per minute played; a defeat keeps 75%. The HUD shows the coins earned so far ("12 P"), and the end screen lists where they came from and the new balance. In a shared run every player, guests too, earns for themselves. Spend them at Poochyena's stall in the town or from Shop on the title menu: five permanent upgrades (Vitality, Second Wind, Respite, Reflexes, Insight) of three to five levels each, with small increments, applied at the start of every run for every species.

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
| 1 / 2 / 3 | Pick a held item when the offer shows (or click its card) |
| M | Mute or unmute sound |
| Esc | Menu: resume, quick settings (lock type, click-to-lock, volume, mute, language), restart floor, quit to the main menu. The solo demo pauses while it is open |

Moving the mouse never changes the locked target; only the gestures above do.

Aegislash blocks hits from the front in Shield Forme (the blue arc): flank it. In Blade Forme it attacks in combos and stays open afterwards.

### Online rooms (netcode spike)

"Play online" in the main menu: **Create room** makes a 5-character code (no 0/O or 1/I/L) and shows it big with a copy button; **Hide code** masks it for streamers. Friends type it under **Join** (or open the page with `?room=CODE` to prefill it). Up to 4 players; a fifth is told the room is full. The host sees who is in the room and presses **Start**; everyone plays the host's seed. Peers find each other through public Nostr relays ([Trystero](https://github.com/dmotz/trystero) 0.26, default strategy) and then talk browser to browser over WebRTC. No TURN server is configured, so two players behind strict NATs may not connect. Trystero loads only when you open a room, never in solo play. `?lag=`, `?jitter=`, `?loss=` and `?delay=` work here too. In a shared run, **F3** shows the net stats overlay: role, players connected, round trip per player, snapshots per second and their age (guest), and bytes per second out and in.

### Two tabs together (netcode spike)

Open the game with `?net=local` in two or more windows of the same browser (up to 4 players) and press Start in each: the first one (or the one with `?host=1`) hosts and the others join it; everyone plays the host's seed. Each tab simulates its own player with no wait, the host runs the enemies, and an enemy attack only hurts you if it touches you on your own screen. Remote players show as "P2", "P3"... with an HP bar; a fainted one stays down (no revive yet). The host's stairs take everyone down. `?lag=150&jitter=30&loss=0.05` simulates a bad network on what that tab sends, and `?delay=100` tunes how far in the past remote players and enemies are drawn. Tabs opened at the same instant agree on one host (the lowest random id). Remote players' projectiles are drawn on every screen. If the host closes, guests get "The host left" and a button back to the menu. A perfect dodge in a shared run gives the dodger the flash and sound but never slows the enemies for anyone. Every standing player gains the experience of every enemy defeated, each picks their own held items, and Oran Berries are host-authoritative (the first player to claim one gets it). Use separate windows side by side: a browser stops animating a hidden tab, and a hidden host stops the run.

### Phones, tablets and installing

Touch controls turn on at the first touch (Settings → Touch controls: Automatic, On, Off): a floating joystick in the left half, Roll / Fast / Heavy (hold to charge) / Lock (tap to lock the enemy in front, swipe sideways to switch target) on the right, Pause and Map at the top right, an on-screen "Atrás" for Esc in menus (the shop too; the end screen uses its own "Back to menu"), and a joystick plus "Hablar" in the town. In the shop a tap on an upgrade shows its effect and a second tap buys it, so a stray tap never spends coins; in landscape the shop and the end screen lay out in two columns to fit a phone. Auto-aim (nearest enemy in a cone in front when nothing is locked) and vibration are settings. Landscape is recommended. The game is a PWA: `public/manifest.webmanifest` (icons drawn by `node tools/make-icons.mjs`) and `public/sw.js`, a versioned service worker registered only in builds, which precaches the app shell, caches sprites, tiles and music as they load, never touches cross-origin traffic (online rooms), and shows "Nueva versión disponible — Actualizar" when a new deploy is waiting. Chrome/Edge/Android get an "Instalar juego" title entry and a one-time banner; iOS Safari gets Share → Add to Home Screen instructions.

## Sound

Sound effects are procedural Web Audio (`src/adapters/audio.ts`), with no sound files: short retro effects synthesised from oscillators, noise and filters, mapped from the core's `GameEvent`s (a pure `soundFor(event)`), throttled per sound and capped in simultaneous voices. Sound starts on the first click or key press, since browsers block autoplay. The menu has master, music and effects volume sliders and a mute checkbox (remembered with the other settings); `M` toggles mute in game; the Esc menu lowers the music.

### Music

Each context has a licensed track (manifest with loop points, licenses and change notes in `src/data/music.ts`; files in `public/music/`): the title, menus and lobby play *Lonely Village*, generated Crypt floors *RPG - Underworld Theme - Loop*, the collapse floor *Determined Pursuit*, the guardian *16-bit - Battle Theme I* (also the Trevenant mid-boss), the Misty Forest floors *Cathedral in the forest* (muffled by a low-pass on fog floors), Decidueye *Boss Battle #2 [Symphonic Metal]*, and the end screens a one-shot stinger (*Victory* by Umplix, *Game Over Theme II*). A track is fetched and decoded the first time its context plays (a two-entry LRU keeps recent buffers), loops gaplessly between sample-accurate loop points (`AudioBufferSourceNode` `loopStart`/`loopEnd`) and cross-fades over 1.2 s on context changes; stingers stop the loop quickly and play once. Files are Ogg Opus with an MP3 for browsers without Ogg (Safari before 18.4), loudness-normalised to -18 LUFS (stingers -16). If a file cannot be fetched or decoded, the floor music falls back to the original procedural chiptune (A minor, `src/data/audio.ts`; faster on the boss floor) and the stingers to synthesised ones. In a shared run each player hears the music of their own state; nothing goes over the network.

Licenses: six CC0 1.0 tracks (Eldritch Grim, Emma_MA, HydroGene, Umplix, Cleyton Kauffman, nene) and one CC BY 4.0 track (jocolloman), credited with their changes in `CREDITS.md` and `public/music/LICENSES.md`. Credit lines must stay in any redistribution; when a stream VOD is re-uploaded, put the CC BY credit in its description.

## Layout

| Path | What |
|---|---|
| `src/core` | Pure, deterministic simulation (no DOM, no adapters; compiled without DOM typings) |
| `src/data` | Typed game data: species, moves, type chart, level curve, held items, coin rules, upgrades, sprite meta |
| `src/adapters` | Rendering, input, assets, audio, storage |
| `src/net` | Netcode spike: protocol, interpolation buffer, transports (BroadcastChannel, lag simulator), peer session |
| `src/app` | Bootstrap and wiring, the save facade (`save.ts`) and the shop window |
| `src/pwa` | Install invitation rules and service worker registration (the worker itself is `public/sw.js`) |
| `src/i18n` | `es.json` (default) and `en.json` |

## Legal

Non-commercial fan project. Pokémon and its characters belong to Nintendo, Creatures Inc., GAME FREAK and The Pokémon Company. Sprites come from [PMDCollab SpriteCollab](https://github.com/PMDCollab/SpriteCollab) under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/); per-artist credits are in [`CREDITS.md`](CREDITS.md).
