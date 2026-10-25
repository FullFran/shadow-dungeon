import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameEvent } from '../../src/core/state';
import { busGains, MENU_DUCK, createAudio, createSfxGate, soundFor, SOUND_IDS, stepSeconds } from '../../src/adapters/audio';

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
      audio.setMusic('room');
      audio.setMusic(null);
      audio.setVolumes({ masterVolume: 0, musicVolume: 0, sfxVolume: 0, muted: true });
    }).not.toThrow();
  });
});

/** Just enough of Web Audio to run the synthesis; it throws where real browsers do. */
class FakeAudioContext {
  currentTime = 0;
  state = 'running';
  sampleRate = 64;
  destination = {};
  started = 0;
  private param() {
    return {
      value: 1,
      setValueAtTime: () => undefined,
      linearRampToValueAtTime: () => undefined,
      setTargetAtTime: () => undefined,
      cancelScheduledValues: () => undefined,
      exponentialRampToValueAtTime: (v: number) => {
        if (!(v > 0)) throw new RangeError('exponential ramp to a non-positive value');
      },
    };
  }
  private node() {
    return { connect: (n: unknown) => n, disconnect: () => undefined };
  }
  createGain() {
    return { ...this.node(), gain: this.param() };
  }
  createOscillator() {
    return { ...this.node(), type: 'sine', frequency: this.param(), start: () => this.started++, stop: () => undefined };
  }
  createBiquadFilter() {
    return { ...this.node(), type: 'lowpass', Q: this.param(), frequency: this.param() };
  }
  createBufferSource() {
    return {
      ...this.node(),
      buffer: null,
      start: (_t: number, offset = 0) => {
        if (offset < 0) throw new RangeError('negative offset');
        this.started++;
      },
      stop: () => undefined,
    };
  }
  createBuffer(_channels: number, length: number) {
    return { duration: 1, getChannelData: () => new Float32Array(length) };
  }
  resume() {
    return Promise.resolve();
  }
}

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
    const audio = createAudio({ masterVolume: 1, musicVolume: 1, sfxVolume: 1, muted: false });
    audio.setMusic('room');
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
    for (const track of ['room', 'boss'] as const) {
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
