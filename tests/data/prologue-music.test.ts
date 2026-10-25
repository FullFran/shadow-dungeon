import { describe, expect, it } from 'vitest';
import { createAudio } from '../../src/adapters/audio';
import { eclipseRevealAtMs, PROLOGUE } from '../../src/data/prologue';
import { eventsBetween, PROLOGUE_MUSIC, prologueScore, type Score } from '../../src/data/prologue-music';
import { totalMs } from '../../src/ui/cinematic';

const score = prologueScore();
const reveal = eclipseRevealAtMs() / 1000;

describe('prologue score', () => {
  it('lasts exactly as long as the prologue and keeps every event inside it', () => {
    expect(score.durationS).toBe(totalMs(PROLOGUE) / 1000);
    for (const e of score.events) {
      expect(e.atS).toBeGreaterThanOrEqual(0);
      expect(e.atS + e.durS).toBeLessThanOrEqual(score.durationS + 0.01);
      expect(e.gain).toBeGreaterThan(0);
      expect(e.gain).toBeLessThanOrEqual(1);
      expect(e.midi.length).toBeGreaterThan(0);
    }
  });

  it('is sorted by start time', () => {
    const times = score.events.map((e) => e.atS);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('hits the timpani on the eclipse reveal, the loudest hit of the piece', () => {
    const hits = score.events.filter((e) => e.voice === 'timpani');
    const onReveal = hits.find((e) => Math.abs(e.atS - reveal) < 1e-6);
    expect(onReveal).toBeDefined();
    expect(Math.max(...hits.map((e) => e.gain))).toBe(onReveal!.gain);
  });

  it('falls silent just before the reveal', () => {
    const hush = score.events.filter((e) => e.atS < reveal && e.atS + e.durS > reveal - 1);
    expect(hush).toEqual([]);
  });

  it('uses drones, pads and bells as well as timpani', () => {
    expect(new Set(score.events.map((e) => e.voice))).toEqual(new Set(['drone', 'pad', 'bell', 'timpani']));
  });

  it('finds the events that start in a window, start inclusive, end exclusive', () => {
    const tiny: Score = {
      durationS: 10,
      events: [
        { atS: 0, voice: 'bell', midi: [69], durS: 1, gain: 0.1 },
        { atS: 2, voice: 'bell', midi: [69], durS: 1, gain: 0.1 },
        { atS: 4, voice: 'bell', midi: [69], durS: 1, gain: 0.1 },
      ],
    };
    expect(eventsBetween(tiny, 0, 2).map((e) => e.atS)).toEqual([0]);
    expect(eventsBetween(tiny, 2, 4.5).map((e) => e.atS)).toEqual([2, 4]);
    expect(eventsBetween(tiny, 5, 9)).toEqual([]);
  });
});

describe('prologue music manifest', () => {
  it('plays the procedural score until a licensed file is set', () => {
    expect(PROLOGUE_MUSIC.file).toBeNull();
    expect(PROLOGUE_MUSIC.score.events.length).toBeGreaterThan(0);
  });

  it('is a silent no-op where Web Audio does not exist', () => {
    const audio = createAudio({ masterVolume: 1, musicVolume: 1, sfxVolume: 1, muted: false });
    expect(() => {
      audio.playCue(PROLOGUE_MUSIC);
      audio.stopCue();
    }).not.toThrow();
  });
});
