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
export type MusicContext = 'title' | 'crypt' | 'collapse' | 'guardian' | 'victory' | 'defeat';

/** Contexts with a planned track but no file yet (later milestones). */
export type PlannedMusicContext = 'prologue' | 'hub' | 'necrozma' | 'forest' | 'caves' | 'swamp';

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
};

export const MUSIC_CONTEXTS = Object.keys(MUSIC_TRACKS) as MusicContext[];

/**
 * Tracks that ship in `public/music/` (licensed, credited, loop-checked) but are
 * not wired to any context yet. Boss Battle #2 played the Aegislash guardian
 * until 2026-10-25 and is kept for a future boss.
 */
export const RESERVED_MUSIC: readonly ReservedTrack[] = [
  {
    reservedFor: 'future-guardian',
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
];

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
    context: 'forest',
    title: 'Cathedral in the forest (ambient loop)',
    artist: 'congusbongus',
    license: 'CC0 1.0',
    sourceUrl: 'https://opengameart.org/content/cathedral-in-the-forest-ambient-loop',
    notes: 'Author says seamless loop.',
  },
  {
    context: 'caves',
    title: 'Underwater',
    artist: 'Cleyton Kauffman',
    license: 'CC0 1.0',
    sourceUrl: 'https://opengameart.org/content/underwater-theme',
    notes: 'Looped per the page; credit requested (Music by Cleyton Kauffman - https://soundcloud.com/cleytonkauffman).',
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
