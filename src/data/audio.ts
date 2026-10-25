/**
 * Music as data: two original chiptune loops in A minor (harmonic minor, so
 * the E chord has a G#). Bars are written as space-separated steps: a note
 * name starts a note, `-` holds the previous one, `.` is a rest. Drum steps
 * are `k` kick, `s` snare, `h` hat or `.`. The audio adapter schedules them.
 */
export interface Note {
  midi: number;
  /** Length in steps, ties included. */
  steps: number;
}

/** One entry per step; a note sits on the step where it starts, every other step is null. */
export type Voice = readonly (Note | null)[];

export type Drum = 'kick' | 'snare' | 'hat';

export type MusicId = 'room' | 'boss';

export interface MusicTrack {
  id: MusicId;
  bpm: number;
  /** Steps per 4/4 bar (8 = eighth notes). */
  stepsPerBar: number;
  bars: number;
  /** Square-wave lead. */
  lead: Voice;
  /** Triangle-wave bass. */
  bass: Voice;
  /** Noise percussion. */
  drums: readonly (Drum | null)[];
}

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** `A4` -> 69, `G#4` -> 68, `Bb2` -> 46. */
export function noteToMidi(name: string): number {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!match) throw new Error(`Bad note name: ${name}`);
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return 12 * (Number(match[3]) + 1) + SEMITONES[match[1]!]! + accidental;
}

const steps = (bars: readonly string[]): string[] => bars.flatMap((bar) => bar.trim().split(/\s+/));

/** Parses melodic bars into a per-step voice. */
export function voice(bars: readonly string[]): (Note | null)[] {
  const tokens = steps(bars);
  const out: (Note | null)[] = tokens.map(() => null);
  let current: Note | null = null;
  tokens.forEach((token, i) => {
    if (token === '-') {
      if (!current) throw new Error(`Tie with no note at step ${i}`);
      current.steps += 1;
    } else if (token === '.') {
      current = null;
    } else {
      current = { midi: noteToMidi(token), steps: 1 };
      out[i] = current;
    }
  });
  return out;
}

const DRUMS: Record<string, Drum | null> = { k: 'kick', s: 'snare', h: 'hat', '.': null };

export function drumVoice(bars: readonly string[]): (Drum | null)[] {
  return steps(bars).map((token) => {
    if (!(token in DRUMS)) throw new Error(`Bad drum step: ${token}`);
    return DRUMS[token]!;
  });
}

// Am | Am | F | E | Dm | Am | E | Am
const LEAD = [
  'A4 - C5 E5 - D5 C5 B4',
  'A4 - - - E4 - G4 A4',
  'F4 - A4 C5 - B4 A4 G4',
  'G#4 - B4 E5 - - D5 B4',
  'D5 - F5 E5 D5 - C5 D5',
  'E5 - C5 A4 - - B4 C5',
  'B4 - G#4 E4 - F4 G#4 B4',
  'A4 - - - - - . .',
];

const ROOM_BASS = [
  'A2 . A2 . E3 . A2 .',
  'A2 . A2 . E3 . G2 .',
  'F2 . F2 . C3 . F2 .',
  'E2 . E2 . B2 . E2 .',
  'D2 . D2 . A2 . D2 .',
  'A2 . A2 . E3 . A2 .',
  'E2 . E2 . B2 . G#2 .',
  'A2 . E2 . A2 - - .',
];

const BOSS_BASS = [
  'A2 A2 A3 A2 A2 A2 A3 A2',
  'A2 A2 A3 A2 G2 G2 G3 G2',
  'F2 F2 F3 F2 F2 F2 F3 F2',
  'E2 E2 E3 E2 E2 E2 E3 E2',
  'D2 D2 D3 D2 D2 D2 D3 D2',
  'A2 A2 A3 A2 A2 A2 A3 A2',
  'E2 E2 E3 E2 G#2 G#2 G#3 G#2',
  'A2 A2 A3 A2 E2 E2 E3 E2',
];

const repeat = (bar: string, times: number, last: string): string[] => [...Array<string>(times - 1).fill(bar), last];

export const ROOM_MUSIC: MusicTrack = {
  id: 'room',
  bpm: 96,
  stepsPerBar: 8,
  bars: 8,
  lead: voice(LEAD),
  bass: voice(ROOM_BASS),
  drums: drumVoice(repeat('k . h . s . h .', 8, 'k . h . s . s s')),
};

/** The boss fight: same tune, faster, with a driving octave bass and busier drums. */
export const BOSS_MUSIC: MusicTrack = {
  id: 'boss',
  bpm: 132,
  stepsPerBar: 8,
  bars: 8,
  lead: voice(LEAD),
  bass: voice(BOSS_BASS),
  drums: drumVoice(repeat('k h k h s h k h', 8, 'k h s h s s s s')),
};

export const MUSIC: Record<MusicId, MusicTrack> = { room: ROOM_MUSIC, boss: BOSS_MUSIC };
