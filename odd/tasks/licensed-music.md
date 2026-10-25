# Licensed music

## Objective
Replace the placeholder procedural music loops with licensed tracks (CC0 preferred, CC BY with credit) chosen from `docs/music-shortlist.md`, one per game context, gapless and loudness-matched, with the procedural chiptune kept as a fallback.

## Problem
The user wants music that sounds hard and fits each zone, without Pokémon/Mystery Dungeon tracks (Twitch VOD muting and DMCA risk). The user delegated the choice: nobody has auditioned the tracks, so picks are made from licenses, author descriptions and objective checks (duration, loop seam, loudness).

## Scope
- Contexts used today: title/menus (eclipse), Crypt floors (exploration), collapse floor, Aegislash guardian, victory stinger, defeat stinger.
- Prepared but unused data entries for later: prologue, hub town, Necrozma, misty forest, flooded caves, toxic swamp (no downloads yet).
- Download, convert to a web format (Ogg Vorbis/Opus or MP3 at a modest bitrate), loudness-normalise, trim/verify loop points; keep each file's license text and source URL next to it; CREDITS.md entries; fix `tools/fetch-sprites.mjs` so regenerating CREDITS.md keeps the font and music sections.
- Audio adapter: lazy-load per context, decode to AudioBuffer and loop gaplessly (loopStart/loopEnd), crossfade on context change, existing music/SFX buses, mute and volume settings; procedural loops as fallback when a file fails to load.

Out of scope: prologue cinematic, hub town, new dungeons, auditioning by ear (the user does it after deploy).

## Constraints
- Licenses verified on each file page; prefer CC0 and low Content ID risk; record changes made to CC BY works (re-encoding, trimming, normalising).
- Core untouched; architecture test green; no AI attribution; Conventional Commits.

## Tasks
- [x] T1 Fetch, verify licenses, convert, normalise and check loop seams; asset manifest with license data; CREDITS.md and generator fix (route: delegated writer; trigger: assets, tools, data, docs)
- [x] T2 Audio adapter streaming playback with gapless loops, crossfades and fallback; wire contexts in the app (route: same writer)
- [x] T3 Deploy (route: parent; standing OK).
- [x] T4 PMD-feel swap: replace Crypt, collapse, guardian, victory and defeat tracks with picks closer to Pokémon Mystery Dungeon's style; keep Lonely Village; keep Boss Battle #2 shipped but reserved (route: delegated writer; trigger: assets, data, tests, docs)

## Acceptance criteria
- Every shipped track has a verified license, a source URL and a credit line.
- Loops have no audible gap by construction (sample-accurate loop points measured with ffmpeg) and similar loudness (within about 2 LU).
- Solo music switches: menu → floors → collapse → boss → stinger; mute and volumes work; a missing file falls back to the procedural loop.
- `npm test` and `npm run build` pass.

## Checks
`npm test`, `npm run build`, ffprobe/ffmpeg loudness and duration report.

## Progress
Created 2026-10-25.

### T1 (done)
Route: delegated writer (assets, tools, data, docs). Licenses re-read on each OpenGameArt file page before download (2026-10-25); downloads processed in scratch dirs outside the repo, ZIPs listed then only audio (and the Shaw EULA PDF, read as text) extracted.

Picks (shipped):

| Context | Track | Author | License | Content ID risk (shortlist) |
|---|---|---|---|---|
| title / menus / lobby | Sad RPG Theme - Lonely Village (rain) | Eldritch Grim | CC0 | Low |
| Crypt floors | Dungeon Ambience | yd | CC0 | Low |
| collapse floor | Out Of Time | Jonathan Shaw | CC BY 3.0 (+ bundled EULA: credit required) | Low |
| guardian (Aegislash) | Boss Battle #2 [Symphonic Metal] | nene | CC0 | Low |
| victory stinger | Fanfares: VICTORY | Spring Spring | CC BY 4.0 (of the offered CC BY 3.0/4.0/BY-SA) | Low |
| defeat stinger | The Fallen | Jonathan Shaw | CC BY 3.0 | Low |

Planned (data only, `PLANNED_MUSIC` in `src/data/music.ts`): prologue Epic Endgame Cinematic (cynicmusic, CC0); hub Lonely Village no-rain (CC0); Necrozma Epic Boss Battle (Juhani Junkala, CC0) with Final Battle of the Dark Wizards (MacLeod, CC BY 4.0) as phase/cutscene option; forest Cathedral in the forest (CC0); caves Underwater (Cleyton Kauffman, CC0); swamp Swamp Theme Loop (beardalaxy, CC0) over Swamp Environment Audio (LokiF, CC0).

Format decision: this ffmpeg has no libvorbis (only the experimental native Vorbis encoder), so the primary format is Ogg Opus 96 kb/s (48 kHz, stereo) with an MP3 (LAME V5, 44.1 kHz) fallback. caniuse: Safari plays Ogg Opus/Vorbis only from 18.4 (macOS 15.4); older Safari needs the MP3. The adapter picks the format with `canPlayType` and falls back to the other on a decode error.

Loudness (two-pass `loudnorm`, linear mode; measured on the shipped files):

| File | Duration s | Loop s | I LUFS | TP dBTP | LRA | Opus bytes | MP3 bytes |
|---|---|---|---|---|---|---|---|
| lonely-village | 29.000 | 2.5-29.0 | -18.0 | -6.1 | 2.0 | 379526 | 492561 |
| dungeon-ambience | 199.000 | 7.0-199.0 | -18.0 | -1.7 | 8.8 | 2219063 | 2408530 |
| out-of-time | 77.199 | 8.0-77.199342 | -18.0 | -6.0 | 2.3 | 959762 | 1178705 |
| boss-battle-2 | 66.207 | 39.72415-66.206803 | -18.0 | -5.7 | 2.9 | 769713 | 997734 |
| victory-fanfare | 3.918 | one-shot | -16.0 | -1.6 | 0.5 | 59399 | 65168 |
| the-fallen | 77.140 | one-shot | -16.0 | -1.8 | 1.3 | 990107 | 1081861 |

`public/music/` total about 11.6 MB (Opus 5.4 MB + MP3 6.2 MB); a browser downloads one format only, lazily per context.

Loop decisions (seam metric: |first loop sample - linear prediction from the last two| / RMS sample step around the seam; about 1 or less means the jump is no larger than an ordinary step):
- Lonely Village: no internal repeat found (cross-correlation max 0.59) and the file fades out from 29.5 s, so it is cut at 29.0 s and the last 1.5 s equal-power cross-fade into 1.0-2.5 s. Seam ratio master 1.04/0.31 (L/R), Opus 0.92/0.25.
- Dungeon Ambience: no internal repeat (corr 0.38), fade from about 200 s; cut at 199 s with a 3 s cross-fade into 4-7 s. Quiet source (-39.7 LUFS, TP -19.3): `loudnorm` would go dynamic (time-varying gain breaks a loop), so +21.7 dB linear gain plus a peak limiter instead. Seam ratio 0.46/0.46 master, 1.63/2.66 Opus at about -40 dBFS.
- Out Of Time: the piece repeats with period 69.199342 s (corr 0.97-0.98); loop 8.0 s to 77.199342 s, file cut there. Seam ratio 0.15/0.43 master, 0.54/0.70 Opus.
- Boss Battle #2: seam check confirms the page note (ZIP names swapped: `*_opening.wav` loops cleanly, ratio 0.21/0.5; `*_loop.wav` does not, 10.3). Opening + loop joined; the plain junction clicked (ratio 11), so the opening's last 10 ms cross-fade into the loop's own last 10 ms. Junction ratio 0.19/0.5, loop seam 0.21/0.5 master, 1.49/1.23 Opus.
- Codec delay: ffmpeg decodes both files to the exact master length (Opus pre-skip 312 samples, MP3 LAME delay honoured); the adapter shifts loop points by the known start padding if a browser returns a longer buffer.

CREDITS.md: Music and Audio sections added; `tools/fetch-sprites.mjs` now regenerates only the sprite section (`creditsMarkdown` and `mergeCredits` moved to `tools/sprite-lib.mjs`, tested, and a no-op on the current file).
Checks: `npm test` 50 files / 459 tests green; typecheck green.

### T2 (done)
Route: same delegated writer. Test-first: new pure-part and fake-AudioContext tests observed RED (15 failing) before the adapter change, then GREEN.
- `src/adapters/audio.ts`: `setMusic(context)` now takes a `MusicContext`. Pure, tested: `floorMusic`, `musicFormats` (Ogg Opus first if `canPlayType` says so, else MP3 first), `musicUrl`, `loopWindow` (shifts loop points by the known start padding only when a decoder returns a longer buffer), `fadeCurve` (equal power), `createLru` (2 decoded buffers; decoded PCM is large: Dungeon Ambience is about 76 MB at 48 kHz stereo float).
- Playback: lazy fetch + decodeAudioData (promise and callback forms), one `AudioBufferSourceNode` per voice with `loop`/`loopStart`/`loopEnd`, its own gain under the music bus (so volume, mute and the Esc-menu duck apply), 1.2 s equal-power cross-fade, stale loads dropped, stingers one-shot after a 0.25 s fade of the loop. Fallbacks: no AudioContext = silent no-op; fetch/decode failure in both formats = procedural `room` (Crypt, collapse) or `boss` (guardian) loop, synthesised `victory`/`defeat` sfx for the stingers, silence for the title.
- Wiring: `show()` in `main.ts` sets the title music for every backdrop screen (title, loadout, settings, credits, online, lobby, waits) and the result screen passes its stinger; `game.ts` uses `floorMusic(isBossFloor(run), run.kind)`; shared runs: each peer plays per its own floor, nothing networked. Credits screen lists the music attributions from the manifest (new i18n key `credits.music`, ES + EN; `credits.audio` reworded).
- README: Music section with the licenses summary.
Checks: `npm test` 50 files / 473 tests green; `npm run build` green (dist 12.9 MB, of which music 11.6 MB).
Not verified: no browser available here (Playwright Chrome not installed), so real decodeAudioData trimming, the seam by ear and Safari's MP3 path are unverified. Nobody has listened to any track.

### T4 PMD-feel swap (done)
Route: delegated writer (assets, data, tests, docs), branch `feat/music-pmd-feel`.
Request (2026-10-25): "La música del inicio me gusta, y la de Aegislash también, pero hazlo más inspirado en Pokémon Mundo Misterioso." Keep Lonely Village; replace Crypt (too ambient), collapse, victory (too cheerful) and defeat (77 s, too long). Scope addition the same day: replace the Aegislash track too with a more PMD-like boss theme, and keep Boss Battle #2 shipped and credited but reserved for a future boss (`RESERVED_MUSIC`, `reservedFor: 'future-guardian'`), not wired to any context.
Rules applied: melodic lead over a steady groove, JRPG synth-orchestral/SNES instrumentation, loopable; no Nintendo/Chunsoft remixes, covers or track-specific imitations (none of the shortlisted pages mention Pokémon, PMD or a remix); CC0 first, then low-risk CC BY; no Scott Buckley, Pixabay or extra-EULA works (so the Jonathan Shaw EULA question is gone).

Search and licenses: OpenGameArt advanced search (music; keywords dungeon, jrpg, boss battle, fanfare, victory, game over, jingle, defeat, mystery dungeon, 16-bit snes); each candidate's file page fetched and its License(s) field read before downloading (WebFetch re-read for Underworld, Determined Pursuit, Battle Theme I and Victory). Downloads in `/tmp/pmd-music/dl/<slug>/` (one empty dir each); ZIPs listed first, only audio (and Junkala's INFO.txt / Cleyton's Readme.txt, read as text) extracted. Shortlist with 2-3 per slot: `docs/music-shortlist.md` section 9 (it also corrects the old "Determined Pursuit is GPL 3.0" note: the page shows only CC0).

Objective analysis (nobody listened). Mono 22.05 kHz, 2048/512 STFT: tempo = beat lag of the autocorrelation of the spectral-flux onset envelope (70-190 bpm, mild preference for 120); pulse = autocorrelation value at that lag (steady-groove measure); flatness = median spectral flatness of active frames (lower = more tonal); pc-prom = median prominence of the dominant pitch class in 200-2000 Hz per 0.23 s block; pc-motion = dominant pitch-class changes per second. Calibration: the estimator gives 107.7 bpm for Underworld (author: 108) and 92.3 for Fairy Boss Battles (author: 185, so half-time); the old Dungeon Ambience scores pulse 0.03, The Fallen 0.03, Out Of Time 0.32.

| Slot | Pick | Author | License | Tempo | Pulse | Flatness | pc-prom | Why |
|---|---|---|---|---|---|---|---|---|
| Crypt | RPG - Underworld Theme - Loop | jocolloman (Joseph Collard) | CC BY 4.0 | 107.7 | 0.83 | 0.065 | 6.64 | Written as RPG underworld/dungeon exploration music; A minor, brass quartet + percussion, "soft, creepy"; strongest groove and tonality of all crypt candidates. CC0 alternate (JRPG End Dungeon) is a final-dungeon mood with a weaker pulse (0.43). |
| Collapse | Determined Pursuit (epic orchestra loop) | Emma_MA | CC0 | 161.5 | 0.73 | 0.380 | 2.81 | "Frantic strings, determined horns and busy drums", written for "a hectic race against the clock"; 1.5x the crypt tempo. |
| Guardian | 16-bit - Battle Theme I | HydroGene | CC0 | 143.6 | 0.64 | 0.287 | 4.00 | SNES-style JRPG battle theme with an intro and a seamless loop; the most direct match to "melodic, driving, synth-orchestral JRPG boss". |
| Victory | Victory | Umplix | CC0 | - | 0.02 | 0.102 | 8.31 | Short tonal fanfare (about 5 s of content, decayed below -30 dB at 6.7 s), the only non-chiptune fanfare that fits 3-8 s without cutting music. |
| Defeat | Game Over Theme II (v3) | CleytonKauffman | CC0 | - | 0.18 | 0.183 | 5.13 | JRPG "game over" (tags sad, minor, retro, 16bit), 8.57 s with a natural decay; v3 is the most tonal/melodic of the three versions (pc-prom 5.13 vs 4.40/4.49). |

Processing (same pipeline as T1): 44.1 kHz float masters built in numpy, linear gain to the target loudness (every pick needed attenuation, so no limiter), Ogg Opus 96 kb/s 48 kHz (libopus) and MP3 LAME V5 44.1 kHz, metadata stripped. Edits:
- Underworld: 108 bpm is exactly 24500 samples a beat and the file is 56 bars (5488000 samples). The whole-file wrap seam is 3.18/0.68, and bars 49-56 restate bars 1-8 (envelope repeat 106.67 s = 48 bars, corr 0.83), so the loop is bars 9-56 (784000-5488000 samples) with the last 50 ms cross-faded (equal power) into the 50 ms before bar 9: the seam then equals the natural bar 8 to bar 9 step.
- Determined Pursuit: whole file loops (master seam 0.26/0.07); unchanged apart from gain.
- Battle Theme I: the ZIP's full file is a separate render (197 samples longer, not sample-identical to intro + loop), so intro (72253 samples) + loop (2609775) are joined with the T1 Boss Battle trick: the intro's last 10 ms cross-fade into the loop's own last 10 ms, so the junction equals the loop seam (junction 0.27/0.46; plain junction would be 1.37/0.19).
- Victory: 24-bit source; the 0.25 s of leading silence dropped (kept 10 ms before onset), cut at 8.0 s with a 1.5 s equal-power fade over the tail.
- Game Over II v3: unchanged apart from gain.

Loudness and loops (ebur128 on the shipped files; seam ratio as in T1, master / Opus / MP3, L/R):

| File | Duration s | Loop s | I LUFS | TP dBTP (Opus/MP3) | LRA | Seam master | Seam Opus | Seam MP3 | Opus bytes | MP3 bytes |
|---|---|---|---|---|---|---|---|---|---|---|
| underworld-theme | 124.444444 | 17.777778-124.444444 | -17.9 | -3.1/-3.0 | 6.5 | 0.09/0.11 | 1.56/0.86 | 0.54/2.55 | 1761935 | 1807469 |
| determined-pursuit | 108.000000 | 0-108.0 | -18.0 | -6.4/-6.1 | 4.1 | 0.26/0.07 | 0.38/0.13 | 0.06/0.04 | 1216189 | 1774979 |
| battle-theme-i | 60.816961 | 1.638390-60.816961 | -18.0 | -5.7/-5.5 | 0.8 | 0.27/0.46 | 0.10/0.53 | 0.05/0.00 | 724104 | 831136 |
| victory-umplix | 8.000000 | one-shot | -15.9 | -5.8/-5.9 | 11.5 | - | - | - | 109269 | 112210 |
| game-over-ii | 8.571429 | one-shot | -15.9 | -5.3/-5.7 | 10.2 | - | - | - | 116876 | 135986 |

Gains: Underworld -1.82 dB, Determined Pursuit -5.23, Battle Theme I -2.85, Victory -4.99, Game Over II -2.40. Decoded lengths: ffmpeg returns the master length for every MP3 and for the Opus files of Underworld, Determined Pursuit and Victory; Battle Theme I and Game Over II Opus decode 1 sample longer (resampling rounding 48 to 44.1 kHz), below the adapter's sub-millisecond rounding tolerance.

Removed from `public/music/` and the manifest: dungeon-ambience, out-of-time, victory-fanfare, the-fallen (both formats). Kept: lonely-village (title), boss-battle-2 (reserved). `public/music/` now 11.2 MB (Opus 5.1 MB + MP3 6.2 MB); licenses: 6 CC0 + 1 CC BY 4.0.

Tests (test-first): `tests/data/music.test.ts` gained checks for stinger length (3-10 s), floor loop length (60-180 s), the reserved Boss Battle #2 entry (not the guardian), one file per track, no unlisted file in `public/music/`, and no "Pokémon/Mystery Dungeon/remix/cover" in titles or change notes; RED observed (RESERVED_MUSIC missing) before the manifest change, then GREEN. `tests/adapters/audio.test.ts` now derives file names from the manifest instead of hardcoding them.
Not verified: nobody has listened (moods from descriptions plus the numbers above); the Victory page gives no instrument notes; Content ID absence is not provable; browser playback not run here.
