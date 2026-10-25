import { noteToMidi } from './audio';
import { eclipseRevealAtMs, PROLOGUE, type PrologueScene } from './prologue';

/**
 * The prologue's music as a timed score (not a loop): slow drones, choir-like
 * pads, sparse bells and timpani, placed on the prologue's own timeline so
 * the big hit lands on the eclipse reveal. Original, in D minor. The audio
 * adapter synthesises it; a licensed recording can replace it by setting
 * `PROLOGUE_MUSIC.file` (the manifest hook).
 */
export type ScoreVoice = 'drone' | 'pad' | 'bell' | 'timpani';

export interface ScoreEvent {
  /** Seconds from the start of the piece. */
  atS: number;
  voice: ScoreVoice;
  /** Notes sounded together. */
  midi: readonly number[];
  durS: number;
  /** Peak gain on the music bus, 0..1. */
  gain: number;
}

export interface Score {
  durationS: number;
  /** Sorted by `atS`. */
  events: readonly ScoreEvent[];
}

export interface CueMusic {
  /** A licensed recording under public/ (e.g. "music/prologue.ogg"); null plays `score`. If it fails to load, `score` plays instead. */
  file: string | null;
  score: Score;
}

/** Events that start in [fromS, toS). */
export function eventsBetween(score: Score, fromS: number, toS: number): ScoreEvent[] {
  return score.events.filter((e) => e.atS >= fromS && e.atS < toS);
}

const chord = (names: string): number[] => names.split(' ').map(noteToMidi);

/** Bells walk this line, one every few seconds. */
const BELLS = ['D5', 'A4', 'C5', 'G4', 'F5', 'D5', 'E5', 'A4'].map(noteToMidi);
const BELL_GAP_S = 4.3;

/** Two pads per scene: the first half and the second half of the panel. */
const PADS: Record<PrologueScene, [string, string] | null> = {
  light: ['F3 A3 C4', 'F3 A3 C4 E4'],
  hunger: ['D3 F3 A3', 'Bb2 D3 F3'],
  dimming: ['Bb2 D3 F3', 'A2 C#3 E3'],
  eclipse: ['D3 F3 A3 D4', 'D3 F3 A3 D4'],
  dungeons: ['G2 D3 G3 Bb3', 'G2 D3 G3 Bb3'],
  shadows: ['Bb2 F3 Bb3', 'A2 E3 A3'],
  guardians: ['D3 A3 D4', 'Bb2 F3 D4'],
  voice: null,
};

export function prologueScore(): Score {
  const reveal = eclipseRevealAtMs() / 1000;
  /** Everything stops this long before the reveal, so the hit lands out of silence. */
  const hushS = 1.2;
  const starts: Partial<Record<PrologueScene, number>> = {};
  let at = 0;
  for (const p of PROLOGUE) {
    starts[p.scene] = at;
    at += p.durationMs / 1000;
  }
  const durationS = at;
  const voiceAt = starts.voice ?? durationS;
  const events: ScoreEvent[] = [];
  const add = (e: ScoreEvent) => events.push({ ...e, durS: Math.min(e.durS, durationS - e.atS) });

  // Drones: one rising out of nothing to the hush, a heavier one from the reveal to the voice.
  add({ atS: 0, voice: 'drone', midi: chord('D2 A2'), durS: reveal - hushS, gain: 0.16 });
  add({ atS: reveal, voice: 'drone', midi: chord('D2 A2 D3'), durS: voiceAt - reveal, gain: 0.2 });

  // Pads, cut short before the hush and starting again with the reveal.
  for (const p of PROLOGUE) {
    const pads = PADS[p.scene];
    const start = starts[p.scene]!;
    if (!pads) continue;
    const half = p.durationMs / 2000;
    const first = p.scene === 'eclipse' ? reveal : start;
    const end = p.scene === 'dimming' ? reveal - hushS : start + p.durationMs / 1000;
    add({ atS: first, voice: 'pad', midi: chord(pads[0]), durS: Math.max(0.5, start + half - first + 0.6), gain: p.scene === 'light' ? 0.06 : 0.075 });
    add({ atS: start + half, voice: 'pad', midi: chord(pads[1]), durS: end - (start + half), gain: p.scene === 'light' ? 0.06 : 0.075 });
  }

  // Bells, sparse, skipping the hush and the reveal.
  let bell = 0;
  for (let t = 2; t < voiceAt - 2; t += BELL_GAP_S) {
    if (t + 4 > reveal - hushS && t < reveal + 3) continue;
    add({ atS: t, voice: 'bell', midi: [BELLS[bell++ % BELLS.length]!], durS: 4, gain: 0.05 });
  }
  // One last bell in the dark, under the voice.
  add({ atS: voiceAt + 1.2, voice: 'bell', midi: [noteToMidi('A4')], durS: 4.5, gain: 0.04 });

  // Timpani: the reveal (boom ... boom-boom), and one for the guardians.
  add({ atS: reveal, voice: 'timpani', midi: [noteToMidi('D2')], durS: 3, gain: 0.7 });
  add({ atS: reveal + 2.2, voice: 'timpani', midi: [noteToMidi('A1')], durS: 2, gain: 0.35 });
  add({ atS: reveal + 2.6, voice: 'timpani', midi: [noteToMidi('D2')], durS: 2.5, gain: 0.45 });
  if (starts.guardians !== undefined) add({ atS: starts.guardians + 0.4, voice: 'timpani', midi: [noteToMidi('D2')], durS: 2.5, gain: 0.4 });

  events.sort((a, b) => a.atS - b.atS);
  return { durationS, events };
}

export const PROLOGUE_MUSIC: CueMusic = { file: null, score: prologueScore() };
