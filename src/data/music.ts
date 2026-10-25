import type { MusicId } from './audio';

/**
 * Licensed music as data: one track per game context, with its license, its
 * source and the changes made to it (CC BY asks for them). Files live in
 * `public/music/` as Ogg Opus plus an MP3 for browsers without Ogg (Safari
 * before 18.4). Loop points are in seconds of the shipped file, measured on
 * the 44.1 kHz masters before encoding (sample-accurate: `samples / 44100`).
 * The audio adapter loads a track the first time its context plays and falls
 * back to the procedural chiptune (`fallback`) when the file cannot be used.
 */
export type MusicContext = 'title' | 'crypt' | 'collapse' | 'guardian' | 'victory' | 'defeat' | 'forest' | 'forest-fog' | 'forest-guardian' | 'caves' | 'caves-flood' | 'caves-guardian';

/** Contexts with a planned track but no file yet (later milestones). */
export type PlannedMusicContext = 'prologue' | 'hub' | 'necrozma' | 'swamp';

export type MusicLicense = 'CC0 1.0' | 'CC BY 3.0' | 'CC BY 4.0';

export interface LicensedTrack {
  context: MusicContext;
  /** Base name in `public/music/`: `<file>.ogg` (Opus) and `<file>.mp3`. */
  file: string;
  /** Length of the shipped file in seconds. */
  duration: number;
  /** Loops play the intro once, then repeat [loopStart, loopEnd); stingers play once. */
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  /** Extra linear gain on top of the loudness normalisation (1 = as normalised). */
  gain: number;
  /** Integrated loudness the file was normalised to (EBU R128, LUFS). */
  lufs: number;
  /** Procedural loop (or sound) to use when the file fails: a chiptune loop id, or null for silence. */
  fallback: MusicId | null;
  title: string;
  artist: string;
  license: MusicLicense;
  licenseUrl: string;
  sourceUrl: string;
  /** Credit line as the author asks for it. */
  attribution: string;
  /** What was done to the original file. */
  changes: string;
  /** A variant of another context's track: same file, played through a filter (no file of its own). */
  variantOf?: MusicContext;
  /** Low-pass cutoff the adapter puts on this context (the muffled fog version of the forest track). */
  lowpassHz?: number;
}

/** A shipped track kept for a later context (`reservedFor`), not played yet. */
export interface ReservedTrack extends Omit<LicensedTrack, 'context'> {
  reservedFor: 'future-guardian';
}

export interface PlannedTrack {
  context: PlannedMusicContext;
  title: string;
  artist: string;
  license: MusicLicense;
  sourceUrl: string;
  notes: string;
}

const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const BY4 = 'https://creativecommons.org/licenses/by/4.0/';
const COMMON = 'Converted to Ogg Opus 96 kb/s and MP3 (LAME V5); metadata stripped.';

export const MUSIC_TRACKS: Record<MusicContext, LicensedTrack> = {
  title: {
    context: 'title',
    file: 'lonely-village',
    duration: 29,
    loop: true,
    loopStart: 2.5,
    loopEnd: 29,
    gain: 1,
    lufs: -18,
    fallback: null,
    title: 'Sad RPG Theme - Lonely Village (rain version)',
    artist: 'Eldritch Grim',
    license: 'CC0 1.0',
    licenseUrl: CC0,
    sourceUrl: 'https://opengameart.org/content/sad-rpg-theme-lonely-village',
    attribution: '"Sad RPG Theme - Lonely Village" by Eldritch Grim (CC0)',
    changes: `Cut at 29.0 s, before the closing fade; the last 1.5 s cross-fade (equal power) into 1.0-2.5 s so the loop 2.5-29.0 s is seamless; loudness-normalised to -18 LUFS. ${COMMON}`,
  },
  crypt: {
    context: 'crypt',
    file: 'underworld-theme',
    duration: 124.444444,
    loop: true,
    // 108 bpm = 24500 samples a beat: the loop is bars 9-56 (784000 to 5488000 samples).
    loopStart: 17.777778,
    loopEnd: 124.444444,
    gain: 1,
    lufs: -18,
    fallback: 'room',
    title: 'RPG - Underworld Theme - Loop',
    artist: 'jocolloman',
    license: 'CC BY 4.0',
    licenseUrl: BY4,
    sourceUrl: 'https://opengameart.org/content/rpg-underworld-theme-loop',
    attribution: '"RPG - Underworld Theme - Loop" by jocolloman (Joseph Collard), CC BY 4.0',
    changes: `Loop moved to bars 9-56 (17.778-124.444 s; bars 49-56 restate bars 1-8), with the last 50 ms cross-faded (equal power) into the 50 ms before bar 9 so the seam is continuous; loudness-normalised to -18 LUFS (-1.8 dB linear gain). ${COMMON}`,
  },
  collapse: {
    context: 'collapse',
    file: 'determined-pursuit',
    duration: 108,
    loop: true,
    // The whole file loops as the page says (seam ratio 0.26/0.07 on the master).
    loopStart: 0,
    loopEnd: 108,
    gain: 1,
    lufs: -18,
    fallback: 'room',
    title: 'Determined Pursuit (epic orchestra loop)',
    artist: 'Emma_MA',
    license: 'CC0 1.0',
    licenseUrl: CC0,
    sourceUrl: 'https://opengameart.org/content/determined-pursuit-epic-orchestra-loop',
    attribution: '"Determined Pursuit" by Emma_MA (CC0)',
    changes: `Loudness-normalised to -18 LUFS (-5.2 dB linear gain); otherwise unchanged. ${COMMON}`,
  },
  guardian: {
    context: 'guardian',
    file: 'battle-theme-i',
    duration: 60.816961,
    loop: true,
    // The intro file is 72253 samples; the author's loop file follows it.
    loopStart: 1.63839,
    loopEnd: 60.816961,
    gain: 1,
    lufs: -18,
    fallback: 'boss',
    title: '16-bit - Battle Theme I',
    artist: 'HydroGene',
    license: 'CC0 1.0',
    licenseUrl: CC0,
    sourceUrl: 'https://opengameart.org/content/16-bit-battle-theme-i',
    attribution: '"16-bit - Battle Theme I" by HydroGene (CC0)',
    changes: `Intro and loop files joined in one file, with a 10 ms cross-fade (equal power) from the intro's tail into the loop's own tail so the junction matches the loop seam; loudness-normalised to -18 LUFS (-2.9 dB linear gain). ${COMMON}`,
  },
  victory: {
    context: 'victory',
    file: 'victory-umplix',
    duration: 8,
    loop: false,
    loopStart: 0,
    loopEnd: 8,
    gain: 1,
    lufs: -16,
    fallback: null,
    title: 'Victory',
    artist: 'Umplix',
    license: 'CC0 1.0',
    licenseUrl: CC0,
    sourceUrl: 'https://opengameart.org/content/victory-4',
    attribution: '"Victory" by Umplix (CC0)',
    changes: `Leading 0.25 s of silence removed; cut at 8.0 s with a 1.5 s fade-out over the decay tail (already below -30 dB); 24-bit source; loudness-normalised to -16 LUFS. ${COMMON}`,
  },
  defeat: {
    context: 'defeat',
    file: 'game-over-ii',
    duration: 8.571429,
    loop: false,
    loopStart: 0,
    loopEnd: 8.571429,
    gain: 1,
    lufs: -16,
    fallback: null,
    title: 'Game Over Theme II (v3)',
    artist: 'CleytonKauffman',
    license: 'CC0 1.0',
    licenseUrl: CC0,
    sourceUrl: 'https://opengameart.org/content/game-over-theme-ii',
    attribution: '"Game Over Theme II" by Cleyton Kauffman (CleytonKauffman) (CC0)',
    changes: `Version 3 of the three in the ZIP; loudness-normalised to -16 LUFS; played once on the defeat screen. ${COMMON}`,
  },
  forest: {
    context: 'forest',
    file: 'cathedral-forest',
    duration: 138.974331,
    loop: true,
    // The master (6040568 samples) loops whole; the file carries its first 2 s again so the seam sits inside the codec stream.
    loopStart: 1,
    loopEnd: 137.974331,
    gain: 1,
    lufs: -18,
    fallback: 'room',
    title: 'Cathedral in the forest (ambient loop)',
    artist: 'congusbongus',
    license: 'CC0 1.0',
    licenseUrl: CC0,
    sourceUrl: 'https://opengameart.org/content/cathedral-in-the-forest-ambient-loop',
    attribution: '"Cathedral in the forest" by congusbongus (CC0)',
    changes: `The whole file loops (seam ratio 0.12/0.07 on the master); its first 2.0 s appended once more and the loop set to 1.0-137.974 s (a rotation of the same loop) so the codecs do not smear the seam; loudness-normalised to -18 LUFS (-4.0 dB linear gain). ${COMMON}`,
  },
  'forest-fog': {
    context: 'forest-fog',
    file: 'cathedral-forest',
    duration: 138.974331,
    loop: true,
    loopStart: 1,
    loopEnd: 137.974331,
    gain: 0.8,
    lufs: -18,
    fallback: 'room',
    title: 'Cathedral in the forest (ambient loop)',
    artist: 'congusbongus',
    license: 'CC0 1.0',
    licenseUrl: CC0,
    sourceUrl: 'https://opengameart.org/content/cathedral-in-the-forest-ambient-loop',
    attribution: '"Cathedral in the forest" by congusbongus (CC0)',
    changes: 'Same file as the forest floors, played through a 700 Hz low-pass and a little quieter on fog floors (the fog muffles it).',
    variantOf: 'forest',
    lowpassHz: 700,
  },
  'forest-guardian': {
    context: 'forest-guardian',
    file: 'boss-battle-2',
    duration: 66.206803,
    loop: true,
    // The opening is 1751835 samples; the seamless loop part follows it.
    loopStart: 39.72415,
    loopEnd: 66.206803,
    gain: 1,
    lufs: -18,
    fallback: 'boss',
    title: 'Boss Battle #2 [Symphonic Metal]',
    artist: 'nene',
    license: 'CC0 1.0',
    licenseUrl: CC0,
    sourceUrl: 'https://opengameart.org/content/boss-battle-2-symphonic-metal',
    attribution: '"Boss Battle #2 [Symphonic Metal]" by nene (CC0)',
    changes: `Opening and loop joined in one file (the ZIP names are swapped, as the page says), with a 10 ms cross-fade from the opening into the loop's own tail; loudness-normalised to -18 LUFS. ${COMMON}`,
  },
  caves: {
    context: 'caves',
    file: 'underwater',
    duration: 172.181814,
    loop: true,
    // The WAV (7505018 samples) does not wrap cleanly (seam 13/18), so its last 2.0 s cross-fade into 1.0-3.0 s and the
    // loop is 3.0 s to the original end; 3.0-5.0 s follow once more so the seam sits inside the codec stream.
    loopStart: 3,
    loopEnd: 170.181814,
    gain: 1,
    lufs: -18,
    fallback: 'room',
    title: 'Underwater',
    artist: 'Cleyton Kauffman',
    license: 'CC0 1.0',
    licenseUrl: CC0,
    sourceUrl: 'https://opengameart.org/content/underwater-theme',
    attribution: 'Music by Cleyton Kauffman - https://soundcloud.com/cleytonkauffman (CC0)',
    changes: `24-bit WAV; the last 2.0 s cross-fade (equal power) into 1.0-3.0 s so the loop 3.0-170.182 s is seamless (seam 0.01/0.04 on the master), 3.0-5.0 s appended after the loop end for the codecs; loudness-normalised to -18 LUFS (-2.5 dB linear gain). ${COMMON}`,
  },
  'caves-flood': {
    context: 'caves-flood',
    file: 'underwater',
    duration: 172.181814,
    loop: true,
    loopStart: 3,
    loopEnd: 170.181814,
    gain: 0.85,
    lufs: -18,
    fallback: 'room',
    title: 'Underwater',
    artist: 'Cleyton Kauffman',
    license: 'CC0 1.0',
    licenseUrl: CC0,
    sourceUrl: 'https://opengameart.org/content/underwater-theme',
    attribution: 'Music by Cleyton Kauffman - https://soundcloud.com/cleytonkauffman (CC0)',
    changes: 'Same file as the caves floors, played through a 900 Hz low-pass and a little quieter on flood floors (heard from under the water).',
    variantOf: 'caves',
    lowpassHz: 900,
  },
  'caves-guardian': {
    context: 'caves-guardian',
    file: 'fairy-boss-battles',
    duration: 105.783787,
    loop: true,
    // The master (4576865 samples) loops whole (seam 0.12/0.01); its first 2 s follow again and the loop is the rotation 1.0-104.784 s.
    loopStart: 1,
    loopEnd: 104.783787,
    gain: 1,
    lufs: -18,
    fallback: 'boss',
    title: 'Fairy Boss Battles',
    artist: 'MintoDog',
    license: 'CC0 1.0',
    licenseUrl: CC0,
    sourceUrl: 'https://opengameart.org/content/fairy-boss-battles',
    attribution: '"Fairy Boss Battles" by MintoDog (CC0)',
    changes: `FLAC master; the whole file loops, its first 2.0 s appended once more and the loop set to 1.0-104.784 s (a rotation of the same loop) so the codecs do not smear the seam; loudness-normalised to -18 LUFS (-7.3 dB linear gain). ${COMMON}`,
  },
};

export const MUSIC_CONTEXTS = Object.keys(MUSIC_TRACKS) as MusicContext[];

/**
 * Tracks that ship in `public/music/` (licensed, credited, loop-checked) but are
 * not wired to any context yet. Boss Battle #2 waited here from 2026-10-25
 * until it became Decidueye's track (`forest-guardian`); none is reserved now.
 */
export const RESERVED_MUSIC: readonly ReservedTrack[] = [];

/** Picks for later contexts, from docs/music-shortlist.md; nothing downloaded yet, licenses to re-check on download. */
export const PLANNED_MUSIC: readonly PlannedTrack[] = [
  {
    context: 'prologue',
    title: 'Epic Endgame Cinematic',
    artist: 'cynicmusic',
    license: 'CC0 1.0',
    sourceUrl: 'https://opengameart.org/content/epic-endgame-cinematic',
    notes: 'Fallback: "Agnus Dei X" by Kevin MacLeod (CC BY 4.0, Content ID risk medium).',
  },
  {
    context: 'hub',
    title: 'Sad RPG Theme - Lonely Village (no rain version)',
    artist: 'Eldritch Grim',
    license: 'CC0 1.0',
    sourceUrl: 'https://opengameart.org/content/sad-rpg-theme-lonely-village',
    notes: 'The rain version already plays on the title; the dry version keeps the hub related but distinct.',
  },
  {
    context: 'necrozma',
    title: 'Epic Boss Battle [Seamlessly Looping]',
    artist: 'Juhani Junkala',
    license: 'CC0 1.0',
    sourceUrl: 'https://opengameart.org/content/boss-battle-music',
    notes: 'In-fight loop; "Final Battle of the Dark Wizards" (Kevin MacLeod, CC BY 4.0) for phase 1 or a cutscene.',
  },
  {
    context: 'swamp',
    title: 'Swamp Theme Loop',
    artist: 'beardalaxy',
    license: 'CC0 1.0',
    sourceUrl: 'https://opengameart.org/node/165341',
    notes: 'Layer over "Swamp Environment Audio" by LokiF (CC0, https://opengameart.org/content/swamp-environment-audio).',
  },
];
