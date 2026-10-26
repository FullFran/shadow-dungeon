import type { FloorKind } from '../data/dungeon';
import type { GameEvent } from '../core/state';
import { MUSIC, type Drum, type MusicId, type MusicTrack, type Note } from '../data/audio';
import { MUSIC_TRACKS, type LicensedTrack, type MusicContext } from '../data/music';
import { eventsBetween, type CueMusic, type ScoreEvent } from '../data/prologue-music';
import { isHeavyHit } from './juice';
import { MOVES } from '../data/moves';
import { cardInfo } from '../data/cards';

/**
 * Web Audio: retro sfx synthesised from oscillators, a noise buffer,
 * envelopes and filters, and the licensed music of `data/music.ts`: each
 * context's file is fetched and decoded the first time it plays (a small LRU
 * keeps recent buffers), looped gaplessly by an AudioBufferSourceNode between
 * its loop points, and cross-faded on context changes. When a file cannot be
 * fetched or decoded, the context falls back to the chiptune loops of
 * `data/audio.ts` (played by a lookahead scheduler on the AudioContext clock).
 * The mapping, throttling, gain, loop and fade maths are pure; the Web Audio
 * part is thin and becomes a silent no-op where `AudioContext` does not exist
 * (tests, old browsers). Browsers block autoplay, so the context is created on
 * the first user gesture (`unlock`).
 */
export const SOUND_IDS = [
  'swingFast',
  'swingHeavy',
  'release',
  'buff',
  'area',
  'hit',
  'hitHeavy',
  'defeated',
  'hurt',
  'disguiseBroken',
  'illusion',
  'flashFire',
  'battleArmor',
  'blocked',
  'dodge',
  'perfectDodge',
  'roll',
  'denied',
  'lock',
  'unlock',
  'telegraph',
  'zoneWarning',
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
  'berry',
  'coin',
  'rallyCry',
  'leaderFall',
  'gateOpen',
  'cardDeclare',
  'cardCapture',
  'turnOpen',
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
    case 'moveStarted': {
      // By slot kind: a boost is heard when it takes hold (buffStarted), an area move with its own whoosh.
      const kind = MOVES[event.moveId]?.slot ?? (event.slotIndex === 0 ? 'fast' : 'heavy');
      return kind === 'fast' ? 'swingFast' : kind === 'heavy' ? 'swingHeavy' : kind === 'area' ? 'area' : null;
    }
    case 'buffStarted':
      return 'buff';
    case 'moveReleased':
      return 'release';
    case 'enemyHit':
      // Burn and poison ticks are silent (the number is enough).
      if (event.dot) return null;
      return isHeavyHit(event) ? 'hitHeavy' : 'hit';
    case 'enemyDefeated':
      return 'defeated';
    case 'playerHurt':
    case 'collapseHurt':
      return 'hurt';
    case 'disguiseBroken':
      return 'disguiseBroken';
    case 'passiveTriggered':
      return event.passive === 'illusion' ? 'illusion' : event.passive === 'flash-fire' ? 'flashFire' : event.passive === 'battle-armor' ? 'battleArmor' : null;
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
      // A positional attack (pierceRoll) has its own warning: walk out of it, rolling will not help.
      return event.pierceRoll ? 'zoneWarning' : 'telegraph';
    case 'enemyAttack':
      return 'enemyAttack';
    case 'bossStance':
      // A card's declaration has its sting; a boss's own moves keep the stance sound.
      return cardInfo(event.stance) ? 'cardDeclare' : 'stance';
    case 'cardCaptured':
      return 'cardCapture';
    case 'bossTurn':
      return 'turnOpen';
    case 'levelUp':
      return 'levelUp';
    case 'itemTriggered':
      return 'item';
    case 'berryEaten':
      return 'berry';
    // Meaningful encounters: a leader's cry (its wind-up is the swelling gold ring), its fall, a gate giving way (a key gate's key is taken with its bearer's fall).
    case 'leaderRally':
      return event.phase === 'cry' ? 'rallyCry' : null;
    case 'leaderFell':
      return 'leaderFall';
    case 'gateOpened':
      return 'gateOpen';
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

// ---------------------------------------------------------------------------
// Licensed music: pure parts.

/** Music of a dungeon floor: the guardian on the boss floor, the urgent track on a collapse, the Crypt loop otherwise. */
export function floorMusic(bossFloor: boolean, kind: FloorKind): MusicContext {
  if (bossFloor) return 'guardian';
  return kind === 'collapse' ? 'collapse' : 'crypt';
}

export type MusicFormat = 'ogg' | 'mp3';

/** Formats to try in order: Ogg Opus where the browser says it can play it (Safari before 18.4 cannot), MP3 first otherwise. */
export function musicFormats(canPlayType: (mime: string) => string): MusicFormat[] {
  return canPlayType('audio/ogg; codecs="opus"') ? ['ogg', 'mp3'] : ['mp3', 'ogg'];
}

export const musicUrl = (baseUrl: string, file: string, format: MusicFormat): string => `${baseUrl}music/${file}.${format}`;

/**
 * Encoder delay at the start of each format, in seconds: Opus pre-skip
 * (312 samples at 48 kHz, libopus) and the LAME delay (1105 samples at
 * 44.1 kHz). Decoders normally trim it; a buffer longer than the file means
 * one did not.
 */
export const START_PAD_S: Record<MusicFormat, number> = { ogg: 312 / 48000, mp3: 1105 / 44100 };

/** Start offset and loop points in the decoded buffer: the manifest's, shifted by the start padding when the decoder kept it. */
export function loopWindow(track: LicensedTrack, bufferDuration: number, startPad: number): { offset: number; loopStart: number; loopEnd: number } {
  const extra = bufferDuration - track.duration;
  const offset = extra > 0.001 ? Math.min(startPad, extra) : 0;
  return { offset, loopStart: track.loopStart + offset, loopEnd: Math.min(track.loopEnd + offset, bufferDuration) };
}

/** Length of a cross-fade between two contexts. */
export const CROSSFADE_S = 1.2;
/** How fast a loop gets out of the way of a stinger. */
export const STINGER_FADE_S = 0.25;
/** Decoded buffers kept (a long track decodes to tens of MB). */
export const MUSIC_CACHE = 2;
const CURVE_STEPS = 64;

/** Gain curve from `from` to `to` on equal-power (quarter sine/cosine) shapes, so a fade-out and a fade-in sum to constant power. */
export function fadeCurve(from: number, to: number, steps: number): Float32Array {
  const curve = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const p = (i / (steps - 1)) * (Math.PI / 2);
    curve[i] = from * Math.cos(p) + to * Math.sin(p);
  }
  curve[0] = from;
  curve[steps - 1] = to;
  return curve;
}

export interface Lru<K, V> {
  get(key: K): V | undefined;
  set(key: K, value: V): void;
}

/** A tiny least-recently-used map: reading or writing a key makes it the newest; the oldest goes past `capacity`. */
export function createLru<K, V>(capacity: number): Lru<K, V> {
  const map = new Map<K, V>();
  return {
    get(key) {
      if (!map.has(key)) return undefined;
      const value = map.get(key)!;
      map.delete(key);
      map.set(key, value);
      return value;
    },
    set(key, value) {
      map.delete(key);
      map.set(key, value);
      while (map.size > capacity) map.delete(map.keys().next().value!);
    },
  };
}

/** What the music needs from the page; injectable for tests. A null `fetchBytes` means no network (procedural music only). */
export interface MusicDeps {
  fetchBytes: ((url: string) => Promise<ArrayBuffer>) | null;
  canPlayType: (mime: string) => string;
  /** Where `public/` is served from (Vite's base). */
  baseUrl: string;
}

function browserMusicDeps(): MusicDeps {
  const fetchBytes =
    typeof fetch === 'function'
      ? (url: string) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${url} -> HTTP ${r.status}`))))
      : null;
  const probe = typeof document !== 'undefined' ? document.createElement('audio') : null;
  return { fetchBytes, canPlayType: (mime) => probe?.canPlayType(mime) ?? '', baseUrl: import.meta.env.BASE_URL };
}

export interface AudioEngine {
  /** Creates or resumes the AudioContext; call from a user gesture. Idempotent. */
  unlock(): void;
  play(id: SoundId): void;
  handleEvents(events: readonly GameEvent[]): void;
  /** Switches the music context (no-op if it is already playing or loading); null fades the music out. Stingers play once. */
  setMusic(context: MusicContext | null): void;
  setVolumes(levels: AudioLevels): void;
  /** Lowers the music while the Esc menu is open. */
  setDucked(ducked: boolean): void;
  /** Collapse rumble loop level, 0..1 (0 keeps it silent). */
  setRumble(level: number): void;
  /**
   * Plays a one-shot cue (the prologue) from `offsetS` in, stopping the loops:
   * its licensed file if it has one, else its synthesised score. Requested
   * before the first gesture, it starts on unlock, in sync with the clock.
   */
  playCue(music: CueMusic, offsetS?: number): void;
  /** Fades the cue out. */
  stopCue(): void;
}

const GATE = { minGapMs: 40, maxVoices: 12 };
const LOOKAHEAD_S = 0.12;
const SCHEDULER_MS = 25;

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
  illusion: {
    ms: 360,
    play: (s, t) => {
      // A shimmer that slides down and dissolves: the disguise melting away.
      arpeggio(s, t, 'triangle', [1760, 1397, 1047, 784], 0.045, 0.2, 0.07);
      noise(s, t + 0.05, { filter: 'bandpass', from: 5000, to: 1200, dur: 0.28, gain: 0.12, q: 4 });
    },
  },
  flashFire: {
    ms: 420,
    play: (s, t) => {
      // A whoosh of flame catching, then a rising crackle.
      noise(s, t, { filter: 'lowpass', from: 600, to: 4200, dur: 0.32, gain: 0.32 });
      tone(s, t, { type: 'sawtooth', from: 180, to: 520, dur: 0.3, gain: 0.07 });
      noise(s, t + 0.18, { filter: 'highpass', from: 3500, dur: 0.06, gain: 0.18 });
    },
  },
  battleArmor: {
    ms: 260,
    play: (s, t) => {
      // A dull, solid thud on bone: lower and drier than a block.
      tone(s, t, { type: 'square', from: 180, to: 90, dur: 0.12, gain: 0.14 });
      tone(s, t, { type: 'triangle', from: 640, to: 520, dur: 0.16, gain: 0.08 });
      noise(s, t, { filter: 'lowpass', from: 1200, to: 300, dur: 0.1, gain: 0.35 });
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
  /** A positional attack winding up: a low, rising two-tone siren, unlike any other cue. */
  zoneWarning: {
    ms: 420,
    play: (s, t) => {
      tone(s, t, { type: 'square', from: 330, to: 440, dur: 0.16, gain: 0.07 });
      tone(s, t + 0.2, { type: 'square', from: 330, to: 523, dur: 0.18, gain: 0.07 });
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
  buff: {
    ms: 520,
    // A boost taking hold: a rising shimmer over a soft swell.
    play: (s, t, v) => {
      arpeggio(s, t, 'triangle', [392 * v, 523 * v, 659 * v, 880 * v], 0.06, 0.26, 0.07);
      noise(s, t, { filter: 'highpass', from: 2500, dur: 0.4, gain: 0.08 });
    },
  },
  area: {
    ms: 360,
    // An area move: a deep, wide whoosh with a low thump.
    play: (s, t, v) => {
      noise(s, t, { filter: 'lowpass', from: 1800 * v, to: 160, dur: 0.34, gain: 0.38 });
      tone(s, t, { type: 'sine', from: 130 * v, to: 45, dur: 0.3, gain: 0.2 });
    },
  },
  item: {
    ms: 260,
    // A short two-note sparkle: an item acted, or one was picked.
    play: (s, t) => arpeggio(s, t, 'triangle', [988, 1319], 0.07, 0.18, 0.07),
  },
  coin: {
    ms: 320,
    // A bright double clink: a purchase at the shop.
    play: (s, t) => {
      arpeggio(s, t, 'square', [1319, 1976], 0.06, 0.2, 0.06);
      tone(s, t + 0.12, { type: 'triangle', from: 2637, dur: 0.12, gain: 0.04 });
    },
  },
  berry: {
    ms: 240,
    // A soft bite and a rising gulp.
    play: (s, t) => {
      noise(s, t, { filter: 'bandpass', from: 1800, to: 900, dur: 0.04, gain: 0.12, q: 2 });
      tone(s, t + 0.05, { type: 'sine', from: 420, to: 880, dur: 0.16, gain: 0.12 });
    },
  },
  rallyCry: {
    ms: 520,
    play: (s, t, v) => {
      // A short horn call, two rising blasts: the leader rallies its band.
      tone(s, t, { type: 'sawtooth', from: 196 * v, to: 262 * v, dur: 0.18, gain: 0.1, attack: 0.02 });
      tone(s, t + 0.2, { type: 'sawtooth', from: 262 * v, to: 330 * v, dur: 0.28, gain: 0.11, attack: 0.02 });
      tone(s, t + 0.2, { type: 'square', from: 131 * v, dur: 0.28, gain: 0.04, attack: 0.02 });
    },
  },
  leaderFall: {
    ms: 600,
    play: (s, t) => {
      // A crown clattering down, then the band losing heart: a falling minor third.
      noise(s, t, { filter: 'highpass', from: 3800, dur: 0.05, gain: 0.25 });
      tone(s, t, { type: 'triangle', from: 1568, to: 1175, dur: 0.18, gain: 0.08 });
      arpeggio(s, t + 0.16, 'square', [392, 330, 262], 0.11, 0.26, 0.07);
    },
  },
  gateOpen: {
    ms: 900,
    play: (s, t) => {
      // A heavy bolt drawn back, stone grinding, and a bright chord: the way down is open.
      noise(s, t, { filter: 'bandpass', from: 700, to: 2200, dur: 0.08, gain: 0.3, q: 2 });
      noise(s, t + 0.08, { filter: 'lowpass', from: 500, to: 160, dur: 0.45, gain: 0.25 });
      tone(s, t + 0.08, { type: 'sine', from: 70, to: 52, dur: 0.45, gain: 0.25 });
      arpeggio(s, t + 0.4, 'triangle', [523, 659, 784], 0.07, 0.4, 0.08);
    },
  },
  cardDeclare: {
    ms: 900,
    play: (s, t) => {
      // The sting: a low hit and a dark, rising pair, then a held bell (the boss names its card).
      tone(s, t, { type: 'sine', from: 110, to: 55, dur: 0.35, gain: 0.35 });
      noise(s, t, { filter: 'lowpass', from: 900, to: 200, dur: 0.25, gain: 0.2 });
      tone(s, t + 0.06, { type: 'sawtooth', from: 147, to: 220, dur: 0.3, gain: 0.08, attack: 0.02 });
      tone(s, t + 0.06, { type: 'sawtooth', from: 156, to: 233, dur: 0.3, gain: 0.05, attack: 0.02 });
      tone(s, t + 0.32, { type: 'triangle', from: 587, dur: 0.5, gain: 0.07, attack: 0.01 });
    },
  },
  cardCapture: {
    ms: 800,
    play: (s, t) => {
      // "¡Técnica dominada!": a bright rising flourish over a soft chord.
      arpeggio(s, t, 'square', [784, 988, 1175, 1568], 0.06, 0.18, 0.06);
      tone(s, t + 0.26, { type: 'triangle', from: 1568, dur: 0.4, gain: 0.07 });
      tone(s, t, { type: 'sine', from: 392, dur: 0.6, gain: 0.08, attack: 0.03 });
    },
  },
  turnOpen: {
    ms: 260,
    play: (s, t) => {
      // "Tu turno": a soft, low breath out (the boss opens; now).
      noise(s, t, { filter: 'bandpass', from: 600, to: 300, dur: 0.18, gain: 0.08, q: 1.5 });
      tone(s, t, { type: 'sine', from: 330, to: 262, dur: 0.2, gain: 0.07, attack: 0.02 });
    },
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

// ---------------------------------------------------------------------------
// Cue voices (the prologue score): sustained sounds need a hold, unlike the sfx.

/** Gain that rises over `attack`, holds, and falls to silence over `release`, ending at t + dur. */
function swell(s: Synth, t: number, dur: number, gain: number, attack: number, release: number, out: AudioNode = s.out): GainNode {
  const node = s.ctx.createGain();
  const a = Math.min(attack, dur / 2);
  const r = Math.min(release, dur - a);
  node.gain.setValueAtTime(0, t);
  node.gain.linearRampToValueAtTime(gain, t + a);
  node.gain.setValueAtTime(gain, t + dur - r);
  node.gain.linearRampToValueAtTime(0, t + dur);
  node.connect(out);
  return node;
}

/** Oscillators of the cue that ring for a long time, so stopping the cue can silence them. */
type Held = OscillatorNode[];

function held(s: Synth, t: number, dur: number, type: OscillatorType, hz: number, detune: number, into: AudioNode, keep: Held): OscillatorNode {
  const osc = s.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(hz, t);
  osc.detune.setValueAtTime(detune, t);
  osc.connect(into);
  osc.start(t);
  osc.stop(t + dur + 0.05);
  keep.push(osc);
  return osc;
}

function lowpass(s: Synth, hz: number, out: AudioNode, q = 0.7): BiquadFilterNode {
  const filter = s.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = hz;
  filter.Q.value = q;
  filter.connect(out);
  return filter;
}

function playScoreEvent(s: Synth, t: number, e: ScoreEvent, keep: Held): void {
  const per = e.gain / Math.sqrt(e.midi.length);
  switch (e.voice) {
    case 'drone': {
      // Detuned saws under a dark low-pass, plus a sine an octave down: a slow, heavy floor.
      const filter = lowpass(s, 260, swell(s, t, e.durS, per, 5, 3));
      for (const midi of e.midi) {
        const hz = midiToHz(midi);
        held(s, t, e.durS, 'sawtooth', hz, -5, filter, keep);
        held(s, t, e.durS, 'sawtooth', hz, 6, filter, keep);
        held(s, t, e.durS, 'sine', hz / 2, 0, filter, keep);
      }
      break;
    }
    case 'pad': {
      // A choir-like pad: three detuned saws per note, a slow vibrato and a soft vowel-ish band.
      const out = swell(s, t, e.durS, per, 2.4, 2.2);
      const filter = lowpass(s, 1100, out, 1.2);
      const vibrato = s.ctx.createOscillator();
      vibrato.frequency.value = 4.6;
      const depth = s.ctx.createGain();
      depth.gain.value = 7;
      vibrato.connect(depth);
      vibrato.start(t);
      vibrato.stop(t + e.durS + 0.05);
      keep.push(vibrato);
      for (const midi of e.midi) {
        for (const cents of [-9, 0, 8]) depth.connect(held(s, t, e.durS, 'sawtooth', midiToHz(midi), cents, filter, keep).detune);
      }
      break;
    }
    case 'bell': {
      // Inharmonic sine partials with long decays.
      for (const midi of e.midi) {
        const hz = midiToHz(midi);
        [1, 2.76, 5.4, 8.93].forEach((ratio, i) => tone(s, t, { type: 'sine', from: hz * ratio, dur: e.durS / (1 + i * 0.8), gain: per / (1 + i * 1.6), attack: 0.004 }));
      }
      break;
    }
    case 'timpani': {
      // A struck membrane: the pitch settles from above, an overtone, and the felt of the mallet.
      for (const midi of e.midi) {
        const hz = midiToHz(midi);
        tone(s, t, { type: 'sine', from: hz * 1.25, to: hz, dur: e.durS, gain: per, attack: 0.006 });
        tone(s, t, { type: 'sine', from: hz * 1.5 * 1.1, to: hz * 1.5, dur: e.durS * 0.5, gain: per * 0.35, attack: 0.006 });
      }
      noise(s, t, { filter: 'lowpass', from: 500, to: 70, dur: 0.6, gain: e.gain * 0.6 });
      break;
    }
  }
}

interface CuePlayback {
  bus: GainNode;
  keep: Held;
  timer: ReturnType<typeof setInterval> | null;
  element: HTMLAudioElement | null;
}

const CUE_FADE_S = 1.2;

interface Playback {
  track: MusicTrack;
  step: number;
  nextTime: number;
  bus: GainNode;
}

/** The music playing now (a file or a chiptune), on its own gain under the music bus. */
interface MusicVoice {
  context: MusicContext;
  stop(fadeS: number): void;
}

/** Sets a gain along an equal-power curve; a linear ramp where curves are refused or cannot be held (Firefox). */
function rampGain(param: AudioParam, from: number, to: number, t: number, dur: number): void {
  const p = param as AudioParam & { cancelAndHoldAtTime?: (t: number) => void };
  if (typeof p.cancelAndHoldAtTime !== 'function') {
    // Firefox: no cancelAndHoldAtTime, a value curve under way cannot be cancelled and any event inside
    // it throws (a track switch mid-fade aborted the run start). Plain ramps cancel cleanly: use them.
    param.cancelScheduledValues(t);
    param.setValueAtTime(from, t);
    param.linearRampToValueAtTime(to, t + dur);
    return;
  }
  p.cancelAndHoldAtTime(t);
  try {
    param.setValueCurveAtTime(fadeCurve(from, to, CURVE_STEPS), t, dur);
  } catch {
    param.setValueAtTime(from, t);
    param.linearRampToValueAtTime(to, t + dur);
  }
}

/** decodeAudioData with both the promise and the callback form (older Safari has only the latter). */
function decode(ctx: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const result = ctx.decodeAudioData(bytes, resolve, reject) as Promise<AudioBuffer> | undefined;
    if (result && typeof result.then === 'function') result.then(resolve, reject);
  });
}

type AudioContextCtor = new () => AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  const g = globalThis as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

export function createAudio(initial: AudioLevels, deps: MusicDeps = browserMusicDeps()): AudioEngine {
  let levels = initial;
  let ducked = false;
  let ctx: AudioContext | null = null;
  let buses: { master: GainNode; music: GainNode; sfx: GainNode } | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  /** The context the game asked for, and the one playing or loading (they differ only before unlock). */
  let wanted: MusicContext | null = null;
  let active: MusicContext | null = null;
  let voice: MusicVoice | null = null;
  /** Bumped on every switch: a load that resolves for an older switch is dropped. */
  let switchId = 0;
  /** Decoded buffers by file name: a filtered variant (the forest's fog version) shares its file's buffer. */
  const decoded = createLru<string, { buffer: AudioBuffer; format: MusicFormat }>(MUSIC_CACHE);
  const formats = musicFormats(deps.canPlayType);
  let rumble: { gain: GainNode } | null = null;
  let cue: CuePlayback | null = null;
  /** A cue asked for before the context existed: what, and when (performance clock, ms). */
  let pendingCue: { music: CueMusic; offsetS: number; askedAt: number } | null = null;
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

  function schedule(p: Playback): void {
    if (!ctx) return;
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

  /** A fresh gain under the music bus for one voice, silent until faded in. */
  function voiceBus(): GainNode | null {
    if (!ctx || !buses) return null;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, ctx.currentTime);
    bus.connect(buses.music);
    return bus;
  }

  function fadeOut(bus: GainNode, fadeS: number): void {
    if (!ctx) return;
    rampGain(bus.gain, bus.gain.value, 0, ctx.currentTime, fadeS);
    setTimeout(() => bus.disconnect(), (fadeS + 0.3) * 1000);
  }

  function startProcedural(context: MusicContext, id: MusicId, fadeS: number): MusicVoice | null {
    const bus = voiceBus();
    if (!ctx || !bus) return null;
    rampGain(bus.gain, 0, 1, ctx.currentTime, fadeS);
    const p: Playback = { track: MUSIC[id], step: 0, nextTime: ctx.currentTime + 0.05, bus };
    const timer = setInterval(() => schedule(p), SCHEDULER_MS);
    schedule(p);
    return {
      context,
      stop(f) {
        clearInterval(timer);
        fadeOut(bus, f);
      },
    };
  }

  function startFile(context: MusicContext, buffer: AudioBuffer, format: MusicFormat, fadeS: number): MusicVoice | null {
    const bus = voiceBus();
    if (!ctx || !bus) return null;
    const track = MUSIC_TRACKS[context];
    const window = loopWindow(track, buffer.duration, START_PAD_S[format]);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (track.loop) {
      source.loop = true;
      source.loopStart = window.loopStart;
      source.loopEnd = window.loopEnd;
    }
    if (track.lowpassHz) {
      // The muffled variant (fog floors): the same buffer through a low-pass.
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(track.lowpassHz, ctx.currentTime);
      source.connect(filter);
      filter.connect(bus);
    } else source.connect(bus);
    const t = ctx.currentTime;
    if (fadeS > 0) rampGain(bus.gain, 0, track.gain, t, fadeS);
    else bus.gain.setValueAtTime(track.gain, t);
    source.start(t, window.offset);
    return {
      context,
      stop(f) {
        if (!ctx) return;
        fadeOut(bus, f);
        source.stop(ctx.currentTime + f + 0.05);
      },
    };
  }

  /** The decoded buffer of a context: cached, or fetched and decoded trying each format in turn; null if none works. */
  async function load(context: MusicContext): Promise<{ buffer: AudioBuffer; format: MusicFormat } | null> {
    const cached = decoded.get(MUSIC_TRACKS[context].file);
    if (cached) return cached;
    const fetchBytes = deps.fetchBytes;
    if (!fetchBytes) return null;
    for (const format of formats) {
      try {
        const bytes = await fetchBytes(musicUrl(deps.baseUrl, MUSIC_TRACKS[context].file, format));
        if (!ctx) return null;
        const entry = { buffer: await decode(ctx, bytes), format };
        decoded.set(MUSIC_TRACKS[context].file, entry);
        return entry;
      } catch {
        // Next format; the procedural fallback when none is left.
      }
    }
    return null;
  }

  /** No usable file: the context's chiptune loop, the synthesised stinger, or silence. */
  function fallback(context: MusicContext): void {
    const track = MUSIC_TRACKS[context];
    if (track.fallback) voice = startProcedural(context, track.fallback, CROSSFADE_S);
    else if (context === 'victory' || context === 'defeat') play(context);
  }

  function switchTo(next: MusicContext | null): void {
    const id = ++switchId;
    active = next;
    const stinger = next !== null && !MUSIC_TRACKS[next].loop;
    voice?.stop(stinger ? STINGER_FADE_S : CROSSFADE_S);
    voice = null;
    if (!next || !ctx) return;
    const begin = (entry: { buffer: AudioBuffer; format: MusicFormat } | null) => {
      if (id !== switchId) return;
      if (entry) voice = startFile(next, entry.buffer, entry.format, stinger ? 0 : CROSSFADE_S);
      else fallback(next);
    };
    // Without a network there is nothing to wait for: fall back now.
    if (!deps.fetchBytes && !decoded.get(MUSIC_TRACKS[next].file)) begin(null);
    else void load(next).then(begin);
  }

  function stopCue(): void {
    pendingCue = null;
    if (!cue || !ctx) return;
    const { bus, keep, timer, element } = cue;
    if (timer) clearInterval(timer);
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + CUE_FADE_S);
    setTimeout(() => {
      element?.pause();
      for (const osc of keep) {
        try {
          osc.stop();
        } catch {
          // Already stopped.
        }
      }
      bus.disconnect();
    }, (CUE_FADE_S + 0.2) * 1000);
    cue = null;
  }

  /** Schedules the score from `offsetS` in, a little ahead of the clock, like the loops. */
  function startScore(music: CueMusic, playback: CuePlayback, offsetS: number): void {
    if (!ctx) return;
    const s = synth(playback.bus);
    if (!s) return;
    const zero = ctx.currentTime + 0.05 - offsetS;
    // Long sounds already under way at the offset still start (their tail plays).
    const sounding = music.score.events.filter((e) => e.atS < offsetS && e.atS + e.durS > offsetS + 1 && (e.voice === 'drone' || e.voice === 'pad'));
    for (const e of sounding) playScoreEvent(s, ctx.currentTime + 0.05, { ...e, atS: offsetS, durS: e.atS + e.durS - offsetS }, playback.keep);
    let cursor = offsetS;
    const tick = () => {
      if (!ctx || cue !== playback) return;
      const until = ctx.currentTime - zero + LOOKAHEAD_S;
      for (const e of eventsBetween(music.score, cursor, until)) playScoreEvent(s, zero + e.atS, e, playback.keep);
      cursor = Math.max(cursor, until);
      if (cursor >= music.score.durationS && playback.timer) clearInterval(playback.timer);
    };
    playback.timer = setInterval(tick, SCHEDULER_MS);
    tick();
  }

  function playCue(music: CueMusic, offsetS = 0): void {
    stopCue();
    if (!ctx || !buses) {
      pendingCue = { music, offsetS, askedAt: performance.now() };
      return;
    }
    wanted = null;
    switchTo(null);
    const bus = ctx.createGain();
    bus.connect(buses.music);
    const playback: CuePlayback = { bus, keep: [], timer: null, element: null };
    cue = playback;
    if (!music.file) {
      startScore(music, playback, offsetS);
      return;
    }
    // The licensed recording; if it cannot play, the score takes over from where it should be.
    const element = new Audio(`${import.meta.env.BASE_URL}${music.file}`);
    playback.element = element;
    const startedAt = performance.now();
    const fallback = () => {
      if (cue !== playback || playback.timer) return;
      element.pause();
      startScore(music, playback, offsetS + (performance.now() - startedAt) / 1000);
    };
    element.addEventListener('error', fallback, { once: true });
    try {
      ctx.createMediaElementSource(element).connect(bus);
      element.currentTime = offsetS;
      void element.play().catch(fallback);
    } catch {
      fallback();
    }
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
      if (pendingCue) {
        const { music, offsetS, askedAt } = pendingCue;
        pendingCue = null;
        playCue(music, offsetS + (performance.now() - askedAt) / 1000);
      } else if (wanted) switchTo(wanted);
    },
    play,
    handleEvents(events) {
      for (const event of events) {
        const id = soundFor(event);
        if (id) play(id);
      }
    },
    setMusic(context) {
      if (context !== null) stopCue();
      if (context === wanted && (!ctx || active === context)) return;
      wanted = context;
      if (ctx) switchTo(context);
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
    playCue,
    stopCue,
  };
}
