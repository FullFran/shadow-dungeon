import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameEvent } from '../../src/core/state';
import {
  busGains,
  CROSSFADE_S,
  MENU_DUCK,
  createAudio,
  createLru,
  createSfxGate,
  fadeCurve,
  floorMusic,
  loopWindow,
  musicFormats,
  musicUrl,
  soundFor,
  SOUND_IDS,
  START_PAD_S,
  stepSeconds,
  type MusicDeps,
} from '../../src/adapters/audio';
import { MUSIC_TRACKS, type MusicContext } from '../../src/data/music';

describe('event -> sound mapping', () => {
  const cases: [GameEvent, string | null][] = [
    [{ type: 'moveStarted', moveId: 'shadow-claw', slotIndex: 0 }, 'swingFast'],
    [{ type: 'moveStarted', moveId: 'play-rough', slotIndex: 1 }, 'swingHeavy'],
    [{ type: 'moveReleased', moveId: 'play-rough', chargeLevel: 2 }, 'release'],
    [{ type: 'enemyHit', enemyId: 'e', damage: 5, effectiveness: 1, pos: { x: 0, y: 0 } }, 'hit'],
    [{ type: 'enemyHit', enemyId: 'e', damage: 5, effectiveness: 2, pos: { x: 0, y: 0 } }, 'hitHeavy'],
    [{ type: 'enemyHit', enemyId: 'e', damage: 40, effectiveness: 1, pos: { x: 0, y: 0 } }, 'hitHeavy'],
    [{ type: 'enemyDefeated', enemyId: 'e' }, 'defeated'],
    [{ type: 'playerHurt', damage: 3 }, 'hurt'],
    [{ type: 'disguiseBroken' }, 'disguiseBroken'],
    [{ type: 'hitBlocked', enemyId: 'e', pos: { x: 0, y: 0 } }, 'blocked'],
    [{ type: 'hitDodged' }, 'dodge'],
    [{ type: 'perfectDodge' }, 'perfectDodge'],
    [{ type: 'rollStarted' }, 'roll'],
    [{ type: 'rollDenied' }, 'denied'],
    [{ type: 'moveDenied', moveId: 'shadow-claw' }, 'denied'],
    [{ type: 'lockAcquired', targetId: 'e' }, 'lock'],
    [{ type: 'lockSwitched', targetId: 'e' }, 'lock'],
    [{ type: 'lockReleased', reason: 'key' }, 'unlock'],
    [{ type: 'enemyTelegraph', enemyId: 'e', attack: 'bite', durationMs: 400 }, 'telegraph'],
    [{ type: 'enemyAttack', enemyId: 'e', attack: 'bite' }, 'enemyAttack'],
    [{ type: 'bossStance', enemyId: 'e', stance: 'blade' }, 'stance'],
    [{ type: 'levelUp', level: 2 }, 'levelUp'],
    [{ type: 'itemTriggered', item: 'sitrus-berry' }, 'item'],
    [{ type: 'berryEaten', berryId: 'f1b2', heal: 20 }, 'berry'],
    // Meaningful encounters (core/leaders.ts, core/gates.ts): the wind-up is seen (the gold ring swells), the cry is heard.
    [{ type: 'leaderRally', enemyId: 'e', phase: 'windup' }, null],
    [{ type: 'leaderRally', enemyId: 'e', phase: 'cry' }, 'rallyCry'],
    [{ type: 'leaderFell', enemyId: 'e', followers: 2 }, 'leaderFall'],
    [{ type: 'gateOpened', kind: 'seal', outcome: 'opened' }, 'gateOpen'],
    [{ type: 'gateOpened', kind: 'key', outcome: 'opened' }, 'gateOpen'],
    [{ type: 'gateOpened', kind: 'waves', outcome: 'broken' }, 'gateOpen'],
    [{ type: 'keyDropped', pos: { x: 0, y: 0 } }, 'keyDrop'],
  ];
  for (const [event, sound] of cases) {
    it(`${event.type} -> ${sound}`, () => expect(soundFor(event)).toBe(sound));
  }

  it('only maps to known sound ids', () => {
    for (const [event] of cases) {
      const sound = soundFor(event);
      if (sound) expect(SOUND_IDS).toContain(sound);
    }
  });
});

describe('sfx gate', () => {
  it('throttles the same sound within the gap but not other sounds', () => {
    const gate = createSfxGate({ minGapMs: 40, maxVoices: 10 });
    expect(gate.admit('hit', 0, 100)).toBe(true);
    expect(gate.admit('hit', 20, 100)).toBe(false);
    expect(gate.admit('lock', 20, 100)).toBe(true);
    expect(gate.admit('hit', 40, 100)).toBe(true);
  });

  it('caps simultaneous voices and frees them when they end', () => {
    const gate = createSfxGate({ minGapMs: 0, maxVoices: 2 });
    expect(gate.admit('a', 0, 100)).toBe(true);
    expect(gate.admit('b', 0, 50)).toBe(true);
    expect(gate.admit('c', 10, 100)).toBe(false);
    // 'b' has finished by 60 ms.
    expect(gate.admit('c', 60, 100)).toBe(true);
    expect(gate.admit('d', 60, 100)).toBe(false);
  });

  it('a refused sound does not reset its throttle', () => {
    const gate = createSfxGate({ minGapMs: 40, maxVoices: 1 });
    expect(gate.admit('a', 0, 100)).toBe(true);
    expect(gate.admit('b', 10, 100)).toBe(false);
    expect(gate.admit('b', 100, 100)).toBe(true);
  });
});

describe('bus gains', () => {
  it('multiplies master into each bus and silences everything when muted', () => {
    const settings = { masterVolume: 0.5, musicVolume: 0.4, sfxVolume: 1, muted: false };
    expect(busGains(settings)).toEqual({ master: 0.5, music: 0.4, sfx: 1 });
    expect(busGains({ ...settings, muted: true }).master).toBe(0);
  });

  it('ducks only the music while the Esc menu is open', () => {
    const settings = { masterVolume: 0.5, musicVolume: 0.4, sfxVolume: 1, muted: false };
    const ducked = busGains(settings, true);
    expect(ducked.music).toBeCloseTo(0.4 * MENU_DUCK);
    expect(ducked.music).toBeLessThan(0.4);
    expect({ master: ducked.master, sfx: ducked.sfx }).toEqual({ master: 0.5, sfx: 1 });
  });
});

describe('music timing', () => {
  it('gives the length of one step from tempo and steps per beat', () => {
    expect(stepSeconds(120, 8)).toBeCloseTo(0.25);
    expect(stepSeconds(60, 4)).toBeCloseTo(1);
  });
});

describe('engine without Web Audio', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is a silent no-op when AudioContext is missing', () => {
    vi.stubGlobal('AudioContext', undefined);
    const audio = createAudio({ masterVolume: 1, musicVolume: 1, sfxVolume: 1, muted: false });
    expect(() => {
      audio.unlock();
      audio.play('hit');
      audio.handleEvents([{ type: 'rollStarted' }]);
      audio.setMusic('crypt');
      audio.setMusic('victory');
      audio.setMusic(null);
      audio.setVolumes({ masterVolume: 0, musicVolume: 0, sfxVolume: 0, muted: true });
    }).not.toThrow();
  });
});

interface FakeSource {
  buffer: unknown;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  startedAt: number | null;
  offset: number;
  stoppedAt: number | null;
  connect: (n: unknown) => unknown;
  disconnect: () => void;
  start: (t: number, offset?: number) => void;
  stop: (t: number) => void;
}

interface FakeGain {
  gain: { value: number; curves: { from: number; to: number; t: number; dur: number }[] };
  disconnected: boolean;
}

/** Just enough of Web Audio to run the synthesis; it throws where real browsers do. */
class FakeAudioContext {
  /** Firefox: no cancelAndHoldAtTime, no event may land inside a value curve, and a curve under way cannot be cancelled. */
  static strictCurves = false;
  currentTime = 0;
  state = 'running';
  sampleRate = 64;
  destination = {};
  started = 0;
  sources: FakeSource[] = [];
  gains: FakeGain[] = [];
  private param() {
    const strict = FakeAudioContext.strictCurves;
    let live: { t: number; end: number }[] = [];
    // A point inside a curve, or a new curve overlapping one, throws.
    const inCurve = (t: number, end?: number) => strict && live.some((c) => (end === undefined ? t > c.t && t < c.end : t < c.end && end > c.t));
    const param = {
      value: 1,
      curves: [] as { from: number; to: number; t: number; dur: number }[],
      setValueCurveAtTime: (curve: Float32Array, t: number, dur: number) => {
        if (inCurve(t, t + dur)) throw new DOMException("Can't add events during a curve event", 'NotSupportedError');
        param.curves.push({ from: curve[0]!, to: curve[curve.length - 1]!, t, dur });
        live.push({ t, end: t + dur });
        param.value = curve[curve.length - 1]!;
      },
      setValueAtTime: (v: number, t = 0) => {
        if (inCurve(t)) throw new DOMException("Can't add events during a curve event", 'NotSupportedError');
        param.value = v;
      },
      linearRampToValueAtTime: () => undefined,
      setTargetAtTime: () => undefined,
      // A curve already under way stays, whatever the cancel time (what Firefox does).
      cancelScheduledValues: (t: number) => {
        live = live.filter((c) => c.t < t || c.t <= this.currentTime);
      },
      exponentialRampToValueAtTime: (v: number) => {
        if (!(v > 0)) throw new RangeError('exponential ramp to a non-positive value');
      },
    };
    // Chromium and Safari hold a running curve where it is.
    if (!strict) Object.assign(param, { cancelAndHoldAtTime: () => undefined });
    return param;
  }
  private node() {
    return { connect: (n: unknown) => n, disconnect: () => undefined };
  }
  createGain() {
    const gain = { ...this.node(), gain: this.param(), disconnected: false };
    gain.disconnect = () => {
      gain.disconnected = true;
    };
    this.gains.push(gain);
    return gain;
  }
  createOscillator() {
    return { ...this.node(), type: 'sine', frequency: this.param(), start: () => this.started++, stop: () => undefined };
  }
  createBiquadFilter() {
    return { ...this.node(), type: 'lowpass', Q: this.param(), frequency: this.param() };
  }
  createBufferSource() {
    const source: FakeSource = {
      ...this.node(),
      buffer: null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      startedAt: null,
      offset: 0,
      stoppedAt: null,
      start: (t: number, offset = 0) => {
        if (offset < 0) throw new RangeError('negative offset');
        source.startedAt = t;
        source.offset = offset;
        this.started++;
      },
      stop: (t: number) => {
        source.stoppedAt = t;
      },
    };
    this.sources.push(source);
    return source;
  }
  /** "Decodes" the bytes from fakeFetch: the file name, or a rejection for names in `undecodable`. */
  undecodable = new Set<string>();
  decodeAudioData(bytes: ArrayBuffer) {
    const url = new TextDecoder().decode(bytes);
    const file = url.split('/').pop()!;
    if (this.undecodable.has(file)) return Promise.reject(new Error('EncodingError'));
    const track = Object.values(MUSIC_TRACKS).find((t) => file.startsWith(`${t.file}.`))!;
    return Promise.resolve({ duration: track.duration, url, getChannelData: () => new Float32Array(0) });
  }
  createBuffer(_channels: number, length: number) {
    return { duration: 1, getChannelData: () => new Float32Array(length) };
  }
  resume() {
    return Promise.resolve();
  }
}

const LEVELS = { masterVolume: 1, musicVolume: 1, sfxVolume: 1, muted: false };
const offline: MusicDeps = { fetchBytes: null, canPlayType: () => 'probably', baseUrl: './' };
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

/** A fake AudioContext global and a fetch that serves every music file by name (and counts requests). */
function setup(options: { canPlay?: string; missing?: string[] } = {}) {
  let ctx: FakeAudioContext | null = null;
  vi.stubGlobal(
    'AudioContext',
    class extends FakeAudioContext {
      constructor() {
        super();
        ctx = this;
      }
    },
  );
  const fetched: string[] = [];
  const deps: MusicDeps = {
    baseUrl: './',
    canPlayType: () => options.canPlay ?? 'probably',
    fetchBytes: (url) => {
      fetched.push(url);
      if (options.missing?.some((m) => url.endsWith(m))) return Promise.reject(new Error('404'));
      return Promise.resolve(new TextEncoder().encode(url).buffer as ArrayBuffer);
    },
  };
  const audio = createAudio(LEVELS, deps);
  audio.unlock();
  return { audio, fetched, fake: ctx as unknown as FakeAudioContext };
}

const fileSources = (fake: FakeAudioContext) => fake.sources.filter((s) => (s.buffer as { url?: string } | null)?.url);
const urlOf = (s: FakeSource) => (s.buffer as { url: string }).url;

describe('music: pure parts', () => {
  it('maps floors to music contexts', () => {
    expect(floorMusic(false, 'normal')).toBe('crypt');
    expect(floorMusic(false, 'collapse')).toBe('collapse');
    expect(floorMusic(true, 'normal')).toBe('guardian');
    expect(floorMusic(true, 'collapse')).toBe('guardian');
  });

  it('prefers Ogg Opus where the browser can play it, MP3 first otherwise', () => {
    expect(musicFormats(() => 'probably')).toEqual(['ogg', 'mp3']);
    expect(musicFormats(() => 'maybe')).toEqual(['ogg', 'mp3']);
    expect(musicFormats(() => '')).toEqual(['mp3', 'ogg']);
    expect(musicUrl('./', 'lonely-village', 'ogg')).toBe('./music/lonely-village.ogg');
    expect(musicUrl('/game/', 'game-over-ii', 'mp3')).toBe('/game/music/game-over-ii.mp3');
  });

  it('keeps the loop points when the decoder trimmed the codec padding', () => {
    const track = MUSIC_TRACKS.guardian;
    expect(loopWindow(track, track.duration, START_PAD_S.mp3)).toEqual({ offset: 0, loopStart: track.loopStart, loopEnd: track.loopEnd });
    // A sub-millisecond difference is rounding, not padding.
    expect(loopWindow(track, track.duration + 0.0005, START_PAD_S.mp3).offset).toBe(0);
  });

  it('shifts the loop points by the start padding when the decoder kept it', () => {
    const track = MUSIC_TRACKS.collapse;
    const w = loopWindow(track, track.duration + 0.05, START_PAD_S.mp3);
    expect(w.offset).toBeCloseTo(START_PAD_S.mp3, 9);
    expect(w.loopStart).toBeCloseTo(track.loopStart + START_PAD_S.mp3, 9);
    expect(w.loopEnd).toBeCloseTo(track.loopEnd + START_PAD_S.mp3, 9);
    // Never past the end of the buffer, never more than the extra length.
    const tight = loopWindow(track, track.duration + 0.003, START_PAD_S.mp3);
    expect(tight.offset).toBeCloseTo(0.003, 9);
    expect(tight.loopEnd).toBeLessThanOrEqual(track.duration + 0.003);
  });

  it('builds equal-power fade curves that cross at constant power', () => {
    const out = fadeCurve(1, 0, 33);
    const into = fadeCurve(0, 1, 33);
    expect([out[0], out[32], into[0], into[32]]).toEqual([1, 0, 0, 1]);
    for (let i = 0; i < 33; i++) expect(out[i]! ** 2 + into[i]! ** 2).toBeCloseTo(1, 6);
    const scaled = fadeCurve(0, 0.5, 9);
    expect(scaled[8]).toBe(0.5);
    for (let i = 1; i < 9; i++) expect(scaled[i]!).toBeGreaterThan(scaled[i - 1]!);
  });

  it('keeps the most recently used entries of a small LRU', () => {
    const lru = createLru<string, number>(2);
    lru.set('a', 1);
    lru.set('b', 2);
    expect(lru.get('a')).toBe(1); // a is now the most recent
    lru.set('c', 3); // evicts b
    expect(lru.get('b')).toBeUndefined();
    expect(lru.get('a')).toBe(1);
    expect(lru.get('c')).toBe(3);
    lru.set('a', 9);
    lru.set('d', 4); // evicts c
    expect([lru.get('a'), lru.get('c'), lru.get('d')]).toEqual([9, undefined, 4]);
  });
});

describe('music: licensed tracks on a fake AudioContext', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('loads nothing until there is an AudioContext, then plays the wanted loop gaplessly', async () => {
    const fetchBytes = vi.fn();
    vi.stubGlobal('AudioContext', undefined);
    const silent = createAudio(LEVELS, { ...offline, fetchBytes });
    silent.setMusic('title');
    silent.unlock();
    await flush();
    expect(fetchBytes).not.toHaveBeenCalled();
    vi.unstubAllGlobals();

    const { audio, fetched, fake } = setup();
    audio.setMusic('title');
    await flush();
    expect(fetched).toEqual(['./music/lonely-village.ogg']);
    const [source] = fileSources(fake);
    expect(source).toMatchObject({ loop: true, loopStart: MUSIC_TRACKS.title.loopStart, loopEnd: MUSIC_TRACKS.title.loopEnd, offset: 0 });
    // Asking again for the playing context changes nothing.
    audio.setMusic('title');
    await flush();
    expect(fileSources(fake)).toHaveLength(1);
  });

  it('cross-fades between contexts and reuses decoded buffers', async () => {
    const { audio, fetched, fake } = setup();
    audio.setMusic('title');
    await flush();
    fake.currentTime = 10;
    audio.setMusic('crypt');
    await flush();
    const [title, crypt] = fileSources(fake);
    expect(urlOf(crypt!)).toBe(`./music/${MUSIC_TRACKS.crypt.file}.ogg`);
    expect(title!.stoppedAt).toBeGreaterThanOrEqual(10 + CROSSFADE_S);
    expect(CROSSFADE_S).toBeGreaterThanOrEqual(1);
    expect(CROSSFADE_S).toBeLessThanOrEqual(1.5);
    const buses = fake.gains.filter((g) => g.gain.curves.length > 0);
    const fadeOut = buses.flatMap((g) => g.gain.curves).find((c) => c.to === 0 && c.t === 10)!;
    const fadeIn = buses.flatMap((g) => g.gain.curves).find((c) => c.from === 0 && c.t === 10)!;
    expect(fadeOut.dur).toBe(CROSSFADE_S);
    expect(fadeIn).toMatchObject({ dur: CROSSFADE_S, to: MUSIC_TRACKS.crypt.gain });
    // Back to the title: decoded already, no new request.
    audio.setMusic('title');
    await flush();
    expect(fetched).toEqual(['./music/lonely-village.ogg', `./music/${MUSIC_TRACKS.crypt.file}.ogg`]);
    expect(fileSources(fake)).toHaveLength(3);
  });

  it('switches tracks in the middle of a fade without throwing where cancelAndHoldAtTime is missing (Firefox)', async () => {
    FakeAudioContext.strictCurves = true;
    try {
      const { audio, fake } = setup();
      audio.setMusic('title');
      await flush();
      fake.currentTime = CROSSFADE_S / 2;
      expect(() => audio.setMusic('crypt')).not.toThrow();
      await flush();
      fake.currentTime = CROSSFADE_S * 0.75;
      expect(() => audio.setMusic('title')).not.toThrow();
    } finally {
      FakeAudioContext.strictCurves = false;
    }
  });

  it('evicts the least recently used buffer beyond the cache size', async () => {
    const { audio, fetched } = setup();
    for (const context of ['title', 'crypt', 'collapse', 'title'] as MusicContext[]) {
      audio.setMusic(context);
      await flush();
    }
    expect(fetched.filter((u) => u.endsWith('lonely-village.ogg'))).toHaveLength(2);
  });

  it('drops a load that finished after the context changed', async () => {
    const { audio, fake } = setup();
    audio.setMusic('crypt');
    audio.setMusic('guardian');
    await flush();
    expect(fileSources(fake).map(urlOf)).toEqual([`./music/${MUSIC_TRACKS.guardian.file}.ogg`]);
    expect(fileSources(fake)[0]).toMatchObject({ loopStart: MUSIC_TRACKS.guardian.loopStart, loopEnd: MUSIC_TRACKS.guardian.loopEnd });
  });

  it('falls back to the MP3 when Ogg does not decode, and asks for MP3 first where Ogg is unsupported', async () => {
    const first = setup();
    const collapse = MUSIC_TRACKS.collapse.file;
    first.fake.undecodable.add(`${collapse}.ogg`);
    first.audio.setMusic('collapse');
    await flush();
    expect(first.fetched).toEqual([`./music/${collapse}.ogg`, `./music/${collapse}.mp3`]);
    expect(fileSources(first.fake).map(urlOf)).toEqual([`./music/${collapse}.mp3`]);
    vi.unstubAllGlobals();
    const safari = setup({ canPlay: '' });
    safari.audio.setMusic('collapse');
    await flush();
    expect(safari.fetched).toEqual([`./music/${collapse}.mp3`]);
  });

  it('plays stingers once, stopping the loop quickly', async () => {
    const { audio, fake } = setup();
    audio.setMusic('guardian');
    await flush();
    fake.currentTime = 50;
    audio.setMusic('victory');
    await flush();
    const [boss, fanfare] = fileSources(fake);
    expect(fanfare).toMatchObject({ loop: false, startedAt: 50 });
    expect(boss!.stoppedAt).toBeLessThan(50 + CROSSFADE_S);
  });

  it('falls back to the procedural loop, or the synthesised stinger, when a file is missing', async () => {
    vi.useFakeTimers();
    const [crypt, defeat] = [MUSIC_TRACKS.crypt.file, MUSIC_TRACKS.defeat.file];
    const { audio, fake } = setup({ missing: [`${crypt}.ogg`, `${crypt}.mp3`, `${defeat}.ogg`, `${defeat}.mp3`] });
    audio.setMusic('crypt');
    await flush();
    expect(fileSources(fake)).toHaveLength(0);
    const before = fake.started;
    const tick = (ms: number) => {
      for (let i = 0; i < ms / 25; i++) {
        fake.currentTime += 0.025;
        vi.advanceTimersByTime(25);
      }
    };
    tick(2000);
    expect(fake.started).toBeGreaterThan(before); // chiptune notes keep being scheduled
    audio.setMusic('defeat');
    await flush();
    const afterStinger = fake.started;
    // The chiptune stopped: no more notes.
    tick(2000);
    expect(fake.started).toBe(afterStinger);
    // The synthesised defeat stinger played instead of the file.
    const defeatOnly = setup({ missing: ['.ogg', '.mp3'] });
    defeatOnly.audio.setMusic('defeat');
    await flush();
    expect(defeatOnly.fake.started).toBeGreaterThan(0);
  });

  it('keeps the title silent when its file is missing (no procedural title loop)', async () => {
    const { audio, fake } = setup({ missing: ['.ogg', '.mp3'] });
    audio.setMusic('title');
    await flush();
    expect(fake.started).toBe(0);
  });
});

describe('engine with a fake AudioContext', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('synthesises every sound and schedules both loops without throwing', () => {
    vi.useFakeTimers();
    let ctx: FakeAudioContext | null = null;
    vi.stubGlobal(
      'AudioContext',
      class extends FakeAudioContext {
        constructor() {
          super();
          ctx = this;
        }
      },
    );
    // No files: every loop falls back to the procedural chiptune, synchronously.
    const audio = createAudio({ masterVolume: 1, musicVolume: 1, sfxVolume: 1, muted: false }, { ...offline, fetchBytes: null });
    audio.setMusic('crypt');
    expect(ctx).toBeNull();
    audio.unlock();
    expect(ctx).not.toBeNull();
    const fake = ctx as unknown as FakeAudioContext;
    // The wanted loop starts on unlock.
    expect(fake.started).toBeGreaterThan(0);
    for (const id of SOUND_IDS) {
      fake.currentTime += 1;
      audio.play(id);
    }
    for (const track of ['crypt', 'guardian'] as const) {
      audio.setMusic(track);
      for (let i = 0; i < 200; i++) {
        fake.currentTime += 0.025;
        vi.advanceTimersByTime(25);
      }
    }
    audio.setMusic(null);
    const before = fake.started;
    vi.advanceTimersByTime(1000);
    expect(fake.started).toBe(before);
  });
});
