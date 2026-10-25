import type { FloorKind } from '../data/dungeon';
import type { GameEvent } from '../core/state';
import { MUSIC, type Drum, type MusicId, type MusicTrack, type Note } from '../data/audio';
import { JUICE } from './juice';

/**
 * Procedural audio with Web Audio, no sound files: retro sfx synthesised from
 * oscillators, a noise buffer, envelopes and filters, plus the chiptune loops
 * of `data/audio.ts` played by a lookahead scheduler on the AudioContext clock.
 * The mapping, throttling and gain maths are pure; the Web Audio part is thin
 * and becomes a silent no-op where `AudioContext` does not exist (tests, old
 * browsers). Browsers block autoplay, so the context is created on the first
 * user gesture (`unlock`).
 */
export const SOUND_IDS = [
  'swingFast',
  'swingHeavy',
  'release',
  'hit',
  'hitHeavy',
  'defeated',
  'hurt',
  'disguiseBroken',
  'blocked',
  'dodge',
  'perfectDodge',
  'roll',
  'denied',
  'lock',
  'unlock',
  'telegraph',
  'enemyAttack',
  'stance',
  'click',
  'victory',
  'defeat',
  'collapse',
  'stairs',
  'floorCard',
  'levelUp',
  'item',
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

/** The sound fields of the player settings. */
export interface AudioLevels {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

/** Which sound a core event makes, if any. */
export function soundFor(event: GameEvent): SoundId | null {
  switch (event.type) {
    case 'moveStarted':
      return event.slotIndex === 0 ? 'swingFast' : 'swingHeavy';
    case 'moveReleased':
      return 'release';
    case 'enemyHit':
      return event.damage >= JUICE.heavyDamage || event.effectiveness > 1 ? 'hitHeavy' : 'hit';
    case 'enemyDefeated':
      return 'defeated';
    case 'playerHurt':
    case 'collapseHurt':
      return 'hurt';
    case 'disguiseBroken':
      return 'disguiseBroken';
    case 'hitBlocked':
      return 'blocked';
    case 'hitDodged':
      return 'dodge';
    case 'perfectDodge':
      return 'perfectDodge';
    case 'rollStarted':
      return 'roll';
    case 'rollDenied':
    case 'moveDenied':
      return 'denied';
    case 'lockAcquired':
    case 'lockSwitched':
      return 'lock';
    case 'lockReleased':
      return 'unlock';
    case 'enemyTelegraph':
      return 'telegraph';
    case 'enemyAttack':
      return 'enemyAttack';
    case 'bossStance':
      return 'stance';
    case 'levelUp':
      return 'levelUp';
    case 'itemTriggered':
      return 'item';
    default:
      return null;
  }
}

/**
 * Sounds on entering a floor (not a core event: the run loads the floor
 * between steps): footsteps down when it was reached by the stairs, the
 * title card chime, and the crash that announces a collapse.
 */
export function floorEntrySounds(kind: FloorKind, descended: boolean): SoundId[] {
  return [...(descended ? (['stairs'] as const) : []), 'floorCard', ...(kind === 'collapse' ? (['collapse'] as const) : [])];
}

/** Peak gain of the collapse rumble loop on the sfx bus. */
export const RUMBLE_GAIN = 0.45;

/** Gain of the rumble loop for a rumble level (0..1); squared so it swells near the front. */
export const rumbleGain = (level: number): number => RUMBLE_GAIN * Math.min(1, Math.max(0, level)) ** 2;

export interface SfxGate {
  /** True if a sound may start now; it then counts against the throttle and the voice cap until it ends. */
  admit(id: string, nowMs: number, durationMs: number): boolean;
}

/** At most one start per sound per `minGapMs`, and at most `maxVoices` sounds ringing at once. */
export function createSfxGate(options: { minGapMs: number; maxVoices: number }): SfxGate {
  const lastStart = new Map<string, number>();
  let voiceEnds: number[] = [];
  return {
    admit(id, nowMs, durationMs) {
      const last = lastStart.get(id);
      if (last !== undefined && nowMs - last < options.minGapMs) return false;
      voiceEnds = voiceEnds.filter((end) => end > nowMs);
      if (voiceEnds.length >= options.maxVoices) return false;
      lastStart.set(id, nowMs);
      voiceEnds.push(nowMs + durationMs);
      return true;
    },
  };
}

/** Music level factor while the Esc menu is open. */
export const MENU_DUCK = 0.3;

/** Gain of each bus; music and sfx sit under the master gain, so they are not multiplied here. */
export function busGains(levels: AudioLevels, ducked = false): { master: number; music: number; sfx: number } {
  return { master: levels.muted ? 0 : levels.masterVolume, music: levels.musicVolume * (ducked ? MENU_DUCK : 1), sfx: levels.sfxVolume };
}

/** Seconds per step for a 4/4 bar split into `stepsPerBar` steps. */
export function stepSeconds(bpm: number, stepsPerBar: number): number {
  return (60 / bpm) * (4 / stepsPerBar);
}

export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export interface AudioEngine {
  /** Creates or resumes the AudioContext; call from a user gesture. Idempotent. */
  unlock(): void;
  play(id: SoundId): void;
  handleEvents(events: readonly GameEvent[]): void;
  /** Switches the loop (no-op if it is already playing); null fades the music out. */
  setMusic(id: MusicId | null): void;
  setVolumes(levels: AudioLevels): void;
  /** Lowers the music while the Esc menu is open. */
  setDucked(ducked: boolean): void;
  /** Collapse rumble loop level, 0..1 (0 keeps it silent). */
  setRumble(level: number): void;
}

const GATE = { minGapMs: 40, maxVoices: 12 };
const LOOKAHEAD_S = 0.12;
const SCHEDULER_MS = 25;
const FADE_S = 0.6;

// ---------------------------------------------------------------------------
// Web Audio: synthesis primitives and recipes.

interface Synth {
  ctx: AudioContext;
  out: AudioNode;
  noise: AudioBuffer;
}

interface ToneSpec {
  type: OscillatorType;
  from: number;
  to?: number;
  dur: number;
  gain: number;
  attack?: number;
}

interface NoiseSpec {
  filter: BiquadFilterType;
  from: number;
  to?: number;
  dur: number;
  gain: number;
  q?: number;
}

function envelope(s: Synth, t: number, dur: number, gain: number, attack = 0.004): GainNode {
  const node = s.ctx.createGain();
  node.gain.setValueAtTime(0.0001, t);
  node.gain.linearRampToValueAtTime(gain, t + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  node.connect(s.out);
  return node;
}

function tone(s: Synth, t: number, spec: ToneSpec): void {
  const osc = s.ctx.createOscillator();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.from, t);
  if (spec.to !== undefined) osc.frequency.exponentialRampToValueAtTime(spec.to, t + spec.dur);
  osc.connect(envelope(s, t, spec.dur, spec.gain, spec.attack));
  osc.start(t);
  osc.stop(t + spec.dur + 0.02);
}

function noise(s: Synth, t: number, spec: NoiseSpec): void {
  const source = s.ctx.createBufferSource();
  source.buffer = s.noise;
  const filter = s.ctx.createBiquadFilter();
  filter.type = spec.filter;
  filter.Q.value = spec.q ?? 1;
  filter.frequency.setValueAtTime(spec.from, t);
  if (spec.to !== undefined) filter.frequency.exponentialRampToValueAtTime(spec.to, t + spec.dur);
  source.connect(filter).connect(envelope(s, t, spec.dur, spec.gain));
  // A random offset so repeated hits do not sound identical.
  source.start(t, Math.random() * (s.noise.duration - spec.dur - 0.05));
  source.stop(t + spec.dur + 0.02);
}

/** A short run of notes (chimes, stingers). */
function arpeggio(s: Synth, t: number, type: OscillatorType, freqs: number[], gap: number, last: number, gain: number): void {
  freqs.forEach((f, i) => tone(s, t + i * gap, { type, from: f, dur: i === freqs.length - 1 ? last : gap * 1.6, gain }));
}

/** Each recipe with its length (for the voice cap). `v` is a small random pitch factor. */
const SFX: Record<SoundId, { ms: number; play(s: Synth, t: number, v: number): void }> = {
  swingFast: { ms: 120, play: (s, t, v) => noise(s, t, { filter: 'bandpass', from: 2200 * v, to: 700, dur: 0.11, gain: 0.3, q: 2 }) },
  swingHeavy: {
    ms: 200,
    play: (s, t, v) => {
      noise(s, t, { filter: 'bandpass', from: 1100 * v, to: 280, dur: 0.19, gain: 0.32, q: 1.5 });
      tone(s, t, { type: 'triangle', from: 190 * v, to: 90, dur: 0.17, gain: 0.12 });
    },
  },
  release: {
    ms: 320,
    play: (s, t, v) => {
      noise(s, t, { filter: 'lowpass', from: 3500 * v, to: 300, dur: 0.3, gain: 0.4 });
      tone(s, t, { type: 'square', from: 240 * v, to: 55, dur: 0.28, gain: 0.12 });
    },
  },
  hit: {
    ms: 100,
    play: (s, t, v) => {
      tone(s, t, { type: 'square', from: 320 * v, to: 80, dur: 0.08, gain: 0.18 });
      noise(s, t, { filter: 'lowpass', from: 2600, to: 500, dur: 0.07, gain: 0.35 });
    },
  },
  hitHeavy: {
    ms: 220,
    play: (s, t, v) => {
      tone(s, t, { type: 'square', from: 220 * v, to: 40, dur: 0.16, gain: 0.25 });
      tone(s, t, { type: 'sine', from: 110, to: 38, dur: 0.22, gain: 0.45 });
      noise(s, t, { filter: 'lowpass', from: 2000, to: 200, dur: 0.15, gain: 0.45 });
    },
  },
  defeated: {
    ms: 380,
    play: (s, t, v) => {
      tone(s, t, { type: 'square', from: 700 * v, to: 90, dur: 0.36, gain: 0.13 });
      noise(s, t + 0.03, { filter: 'lowpass', from: 1600, to: 120, dur: 0.32, gain: 0.25 });
    },
  },
  hurt: {
    ms: 230,
    play: (s, t) => {
      tone(s, t, { type: 'sawtooth', from: 420, to: 110, dur: 0.22, gain: 0.2 });
      noise(s, t, { filter: 'lowpass', from: 1500, to: 300, dur: 0.12, gain: 0.3 });
    },
  },
  disguiseBroken: {
    ms: 280,
    play: (s, t) => {
      // A dry crack, then the costume tearing.
      noise(s, t, { filter: 'highpass', from: 4500, dur: 0.045, gain: 0.5 });
      noise(s, t + 0.04, { filter: 'bandpass', from: 3000, to: 700, dur: 0.22, gain: 0.32, q: 3 });
      tone(s, t + 0.04, { type: 'square', from: 950, to: 260, dur: 0.14, gain: 0.08 });
    },
  },
  blocked: {
    ms: 320,
    play: (s, t, v) => {
      // Inharmonic partials ring like metal.
      tone(s, t, { type: 'square', from: 1240 * v, dur: 0.26, gain: 0.07 });
      tone(s, t, { type: 'triangle', from: 1870 * v, dur: 0.3, gain: 0.1 });
      tone(s, t, { type: 'triangle', from: 2950 * v, dur: 0.18, gain: 0.06 });
      noise(s, t, { filter: 'highpass', from: 5000, dur: 0.04, gain: 0.3 });
    },
  },
  dodge: { ms: 110, play: (s, t) => noise(s, t, { filter: 'highpass', from: 2400, to: 4200, dur: 0.1, gain: 0.12 }) },
  perfectDodge: { ms: 520, play: (s, t) => arpeggio(s, t, 'triangle', [1319, 1976, 2637], 0.05, 0.42, 0.14) },
  roll: { ms: 150, play: (s, t) => noise(s, t, { filter: 'bandpass', from: 600, to: 1300, dur: 0.14, gain: 0.14, q: 1.2 }) },
  denied: { ms: 90, play: (s, t) => tone(s, t, { type: 'square', from: 110, to: 90, dur: 0.08, gain: 0.06 }) },
  lock: { ms: 40, play: (s, t) => tone(s, t, { type: 'square', from: 1500, dur: 0.03, gain: 0.05, attack: 0.002 }) },
  unlock: { ms: 50, play: (s, t) => tone(s, t, { type: 'triangle', from: 900, dur: 0.04, gain: 0.05, attack: 0.002 }) },
  telegraph: {
    ms: 130,
    play: (s, t) => {
      tone(s, t, { type: 'triangle', from: 880, dur: 0.05, gain: 0.05 });
      tone(s, t + 0.07, { type: 'triangle', from: 880, dur: 0.05, gain: 0.05 });
    },
  },
  enemyAttack: { ms: 110, play: (s, t, v) => noise(s, t, { filter: 'bandpass', from: 1300 * v, to: 400, dur: 0.1, gain: 0.16, q: 1.5 }) },
  stance: {
    ms: 650,
    play: (s, t) => {
      tone(s, t, { type: 'sawtooth', from: 80, to: 170, dur: 0.6, gain: 0.16, attack: 0.08 });
      tone(s, t, { type: 'square', from: 160, to: 340, dur: 0.5, gain: 0.06, attack: 0.08 });
      noise(s, t, { filter: 'lowpass', from: 400, to: 2400, dur: 0.5, gain: 0.16 });
    },
  },
  click: { ms: 30, play: (s, t) => tone(s, t, { type: 'square', from: 1000, dur: 0.025, gain: 0.05, attack: 0.002 }) },
  victory: { ms: 900, play: (s, t) => arpeggio(s, t, 'square', [440, 523, 659, 880], 0.12, 0.55, 0.09) },
  defeat: { ms: 1300, play: (s, t) => arpeggio(s, t, 'triangle', [330, 262, 220, 165], 0.22, 0.7, 0.16) },
  stairs: {
    ms: 520,
    play: (s, t) => {
      // Four footsteps going down, each a little lower and softer.
      for (let i = 0; i < 4; i++) {
        noise(s, t + i * 0.11, { filter: 'bandpass', from: 900 - i * 140, to: 300, dur: 0.07, gain: 0.22 - i * 0.03, q: 2 });
        tone(s, t + i * 0.11, { type: 'triangle', from: 260 - i * 30, to: 120, dur: 0.06, gain: 0.07 });
      }
    },
  },
  floorCard: {
    ms: 900,
    play: (s, t) => {
      // A soft, slightly ominous chime under the floor title (A minor, like the music).
      arpeggio(s, t + 0.35, 'triangle', [440, 659, 880], 0.14, 0.5, 0.09);
      tone(s, t + 0.35, { type: 'sine', from: 220, dur: 0.6, gain: 0.08, attack: 0.03 });
    },
  },
  levelUp: {
    ms: 700,
    // A bright rising fanfare, Mystery Dungeon style.
    play: (s, t) => arpeggio(s, t, 'square', [523, 659, 784, 1047], 0.08, 0.4, 0.08),
  },
  item: {
    ms: 260,
    // A short two-note sparkle: an item acted, or one was picked.
    play: (s, t) => arpeggio(s, t, 'triangle', [988, 1319], 0.07, 0.18, 0.07),
  },
  collapse: {
    ms: 1400,
    play: (s, t) => {
      // A deep boom, then rocks crashing down and settling.
      tone(s, t, { type: 'sine', from: 90, to: 28, dur: 1.1, gain: 0.55 });
      // Noise bursts stay under the 1 s noise buffer.
      noise(s, t, { filter: 'lowpass', from: 1800, to: 90, dur: 0.9, gain: 0.55 });
      noise(s, t + 0.18, { filter: 'bandpass', from: 700, to: 160, dur: 0.6, gain: 0.3, q: 0.8 });
      noise(s, t + 0.45, { filter: 'bandpass', from: 500, to: 120, dur: 0.5, gain: 0.22, q: 0.8 });
    },
  },
};

function playDrum(s: Synth, t: number, drum: Drum): void {
  if (drum === 'kick') tone(s, t, { type: 'sine', from: 150, to: 45, dur: 0.12, gain: 0.5 });
  else if (drum === 'snare') {
    noise(s, t, { filter: 'bandpass', from: 1800, dur: 0.1, gain: 0.22 });
    tone(s, t, { type: 'triangle', from: 190, to: 120, dur: 0.05, gain: 0.1 });
  } else noise(s, t, { filter: 'highpass', from: 7000, dur: 0.03, gain: 0.07 });
}

function playNote(s: Synth, t: number, note: Note, stepS: number, type: OscillatorType, gain: number): void {
  tone(s, t, { type, from: midiToHz(note.midi), dur: note.steps * stepS * 0.9, gain, attack: 0.008 });
}

interface Playback {
  track: MusicTrack;
  step: number;
  nextTime: number;
  bus: GainNode;
  timer: ReturnType<typeof setInterval>;
}

type AudioContextCtor = new () => AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  const g = globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

export function createAudio(initial: AudioLevels): AudioEngine {
  let levels = initial;
  let ducked = false;
  let ctx: AudioContext | null = null;
  let buses: { master: GainNode; music: GainNode; sfx: GainNode } | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let wanted: MusicId | null = null;
  let playback: Playback | null = null;
  let rumble: { gain: GainNode } | null = null;
  const gate = createSfxGate(GATE);

  const synth = (out: AudioNode): Synth | null => (ctx && noiseBuffer ? { ctx, out, noise: noiseBuffer } : null);

  function applyLevels(): void {
    if (!ctx || !buses) return;
    const gains = busGains(levels, ducked);
    const t = ctx.currentTime;
    buses.master.gain.setTargetAtTime(gains.master, t, 0.02);
    buses.music.gain.setTargetAtTime(gains.music, t, 0.02);
    buses.sfx.gain.setTargetAtTime(gains.sfx, t, 0.02);
  }

  function schedule(): void {
    if (!ctx || !playback) return;
    const p = playback;
    const s = synth(p.bus);
    if (!s) return;
    const stepS = stepSeconds(p.track.bpm, p.track.stepsPerBar);
    const length = p.track.bars * p.track.stepsPerBar;
    // Back from a throttled background tab: skip ahead instead of a burst.
    if (p.nextTime < ctx.currentTime - 0.2) p.nextTime = ctx.currentTime + 0.05;
    while (p.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      const lead = p.track.lead[p.step];
      const bass = p.track.bass[p.step];
      const drum = p.track.drums[p.step];
      if (lead) playNote(s, p.nextTime, lead, stepS, 'square', 0.07);
      if (bass) playNote(s, p.nextTime, bass, stepS, 'triangle', 0.2);
      if (drum) playDrum(s, p.nextTime, drum);
      p.nextTime += stepS;
      p.step = (p.step + 1) % length;
    }
  }

  function stopMusic(): void {
    if (!playback || !ctx) return;
    const { bus, timer } = playback;
    clearInterval(timer);
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + FADE_S);
    setTimeout(() => bus.disconnect(), (FADE_S + 0.3) * 1000);
    playback = null;
  }

  function startMusic(id: MusicId): void {
    if (!ctx || !buses) return;
    const bus = ctx.createGain();
    bus.connect(buses.music);
    playback = { track: MUSIC[id], step: 0, nextTime: ctx.currentTime + 0.05, bus, timer: setInterval(schedule, SCHEDULER_MS) };
    schedule();
  }

  function play(id: SoundId): void {
    if (!ctx || !buses || levels.muted) return;
    const s = synth(buses.sfx);
    const recipe = SFX[id];
    if (!s || !gate.admit(id, ctx.currentTime * 1000, recipe.ms)) return;
    recipe.play(s, ctx.currentTime, 0.92 + Math.random() * 0.16);
  }

  /** The rumble: looping noise through two low-pass filters, started on first use and kept running at a variable gain. */
  function rumbleNode(): { gain: GainNode } | null {
    if (rumble) return rumble;
    if (!ctx || !buses || !noiseBuffer) return null;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 140;
    const lower = ctx.createBiquadFilter();
    lower.type = 'lowpass';
    lower.frequency.value = 90;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(low).connect(lower).connect(gain).connect(buses.sfx);
    source.start();
    rumble = { gain };
    return rumble;
  }

  return {
    unlock() {
      if (ctx) {
        if (ctx.state === 'suspended') void ctx.resume();
        return;
      }
      const Ctor = audioContextCtor();
      if (!Ctor) return;
      try {
        ctx = new Ctor();
      } catch {
        return;
      }
      const master = ctx.createGain();
      master.connect(ctx.destination);
      const music = ctx.createGain();
      music.connect(master);
      const sfx = ctx.createGain();
      sfx.connect(master);
      buses = { master, music, sfx };
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      applyLevels();
      if (ctx.state === 'suspended') void ctx.resume();
      if (wanted) startMusic(wanted);
    },
    play,
    handleEvents(events) {
      for (const event of events) {
        const id = soundFor(event);
        if (id) play(id);
      }
    },
    setMusic(id) {
      if (id === wanted && (playback || !ctx)) return;
      wanted = id;
      stopMusic();
      if (id) startMusic(id);
    },
    setVolumes(next) {
      levels = next;
      applyLevels();
    },
    setDucked(next) {
      ducked = next;
      applyLevels();
    },
    setRumble(level) {
      const target = rumbleGain(level);
      if (target === 0 && !rumble) return;
      const node = rumbleNode();
      if (!node || !ctx) return;
      node.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.15);
    },
  };
}
