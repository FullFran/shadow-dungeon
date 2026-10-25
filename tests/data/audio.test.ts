import { describe, expect, it } from 'vitest';
import { BOSS_MUSIC, drumVoice, MUSIC, noteToMidi, ROOM_MUSIC, voice, type MusicTrack } from '../../src/data/audio';

describe('note parsing', () => {
  it('converts note names to MIDI numbers', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('G#4')).toBe(68);
    expect(noteToMidi('Bb2')).toBe(46);
    expect(() => noteToMidi('H4')).toThrow();
  });

  it('turns bars into per-step notes with ties and rests', () => {
    expect(voice(['A4 - . C5'])).toEqual([{ midi: 69, steps: 2 }, null, null, { midi: 72, steps: 1 }]);
    expect(drumVoice(['k . s h'])).toEqual(['kick', null, 'snare', 'hat']);
  });

  it('rejects a tie with no note before it', () => {
    expect(() => voice(['- A4'])).toThrow();
  });
});

function checkTrack(track: MusicTrack): void {
  const length = track.bars * track.stepsPerBar;
  expect(track.bars).toBeGreaterThanOrEqual(8);
  expect(track.bars).toBeLessThanOrEqual(16);
  expect(track.bpm).toBeGreaterThan(40);
  expect(track.bpm).toBeLessThan(220);
  for (const part of [track.lead, track.bass]) {
    expect(part).toHaveLength(length);
    part.forEach((note, i) => {
      if (!note) return;
      expect(note.midi).toBeGreaterThanOrEqual(28);
      expect(note.midi).toBeLessThanOrEqual(96);
      expect(note.steps).toBeGreaterThanOrEqual(1);
      // A note never rings past the loop end.
      expect(i + note.steps).toBeLessThanOrEqual(length);
    });
    expect(part.some((n) => n !== null)).toBe(true);
  }
  expect(track.drums).toHaveLength(length);
}

describe('music tracks', () => {
  it('room and boss loops are well formed', () => {
    checkTrack(ROOM_MUSIC);
    checkTrack(BOSS_MUSIC);
  });

  it('the boss loop is more intense than the room loop', () => {
    expect(BOSS_MUSIC.bpm).toBeGreaterThan(ROOM_MUSIC.bpm);
    const hits = (t: MusicTrack) => t.drums.filter((d) => d !== null).length;
    expect(hits(BOSS_MUSIC)).toBeGreaterThan(hits(ROOM_MUSIC));
  });

  it('is indexed by id', () => {
    expect(MUSIC.room).toBe(ROOM_MUSIC);
    expect(MUSIC.boss).toBe(BOSS_MUSIC);
  });
});
