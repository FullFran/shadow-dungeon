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

export interface PlannedTrack {
  context: PlannedMusicContext;
  title: string;
  artist: string;
  license: MusicLicense;
  sourceUrl: string;
  notes: string;
}

const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const BY3 = 'https://creativecommons.org/licenses/by/3.0/';
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
    file: 'dungeon-ambience',
    duration: 199,
    loop: true,
    loopStart: 7,
    loopEnd: 199,
    gain: 1,
    lufs: -18,
    fallback: 'room',
    title: 'Dungeon Ambience',
    artist: 'yd',
    license: 'CC0 1.0',
    licenseUrl: CC0,
    sourceUrl: 'https://opengameart.org/content/dungeon-ambience',
    attribution: '"Dungeon Ambience" by yd (CC0)',
    changes: `Cut at 199.0 s, before the closing fade; the last 3 s cross-fade (equal power) into 4.0-7.0 s so the loop 7.0-199.0 s is seamless; +21.7 dB linear gain to -18 LUFS with a peak limiter. ${COMMON}`,
  },
  collapse: {
    context: 'collapse',
    file: 'out-of-time',
    duration: 77.199342,
    loop: true,
    loopStart: 8,
    // 8 s + one period of the piece (3051691 samples = 69.199342 s, found by cross-correlation).
    loopEnd: 77.199342,
    gain: 1,
    lufs: -18,
    fallback: 'room',
    title: 'Out Of Time (RPG Orchestral Essentials)',
    artist: 'Jonathan Shaw',
    license: 'CC BY 3.0',
    licenseUrl: BY3,
    sourceUrl: 'https://opengameart.org/content/out-of-time-rpg-orchestral-essentials-danger-music',
    attribution: '"Out Of Time" Composed by Jonathan Shaw (www.jshaw.co.uk), CC BY 3.0',
    changes: `Decoded from the MP3; cut at 77.199 s (the repeat point after 8 s), dropping the second pass and the reverb tail; loudness-normalised to -18 LUFS. ${COMMON}`,
  },
  guardian: {
    context: 'guardian',
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
  victory: {
    context: 'victory',
    file: 'victory-fanfare',
    duration: 3.91839,
    loop: false,
    loopStart: 0,
    loopEnd: 3.91839,
    gain: 1,
    lufs: -16,
    fallback: null,
    title: 'Fanfares: VICTORY',
    artist: 'Spring Spring',
    license: 'CC BY 4.0',
    licenseUrl: BY4,
    sourceUrl: 'https://opengameart.org/content/fanfares',
    attribution: '"Fanfares" (VICTORY) by Spring Spring (Spring/Spring Enterprises), CC BY 4.0',
    changes: `Resampled from 48 kHz to 44.1 kHz; loudness-normalised to -16 LUFS. ${COMMON}`,
  },
  defeat: {
    context: 'defeat',
    file: 'the-fallen',
    duration: 77.139592,
    loop: false,
    loopStart: 0,
    loopEnd: 77.139592,
    gain: 1,
    lufs: -16,
    fallback: null,
    title: 'The Fallen (RPG Orchestral Essentials)',
    artist: 'Jonathan Shaw',
    license: 'CC BY 3.0',
    licenseUrl: BY3,
    sourceUrl: 'https://opengameart.org/content/the-fallen-rpg-orchestral-essentials-defeated-music',
    attribution: '"The Fallen" Composed by Jonathan Shaw (www.jshaw.co.uk), CC BY 3.0',
    changes: `Decoded from the MP3; loudness-normalised to -16 LUFS; played once on the defeat screen. ${COMMON}`,
  },
};

export const MUSIC_CONTEXTS = Object.keys(MUSIC_TRACKS) as MusicContext[];

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
