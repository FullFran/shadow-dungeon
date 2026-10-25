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
- [ ] T3 Deploy (route: parent; standing OK)

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
