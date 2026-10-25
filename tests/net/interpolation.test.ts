import { describe, expect, it } from 'vitest';
import { vec, type Vec2 } from '../../src/core/vec';
import { createBuffer, lerpPos, pushSample, sampleAt } from '../../src/net/interpolation';

const mix = (a: Vec2, b: Vec2, t: number) => lerpPos(a, b, t, 64);
const opts = { maxExtrapolateMs: 50 };

function buffer(samples: Array<[number, Vec2, number?]>) {
  let buf = createBuffer<Vec2>();
  for (const [at, value, epoch] of samples) buf = pushSample(buf, { at, epoch: epoch ?? 1, value });
  return buf;
}

describe('interpolation buffer', () => {
  it('is empty until the first sample', () => {
    expect(sampleAt(createBuffer<Vec2>(), 100, mix, opts)).toBeNull();
  });

  it('interpolates linearly between the samples around the render time', () => {
    const buf = buffer([
      [0, vec(0, 0)],
      [50, vec(10, 0)],
      [100, vec(20, 10)],
    ]);
    expect(sampleAt(buf, 75, mix, opts)).toEqual(vec(15, 5));
    expect(sampleAt(buf, 50, mix, opts)).toEqual(vec(10, 0));
  });

  it('holds the oldest sample before the buffer starts', () => {
    const buf = buffer([
      [100, vec(5, 5)],
      [150, vec(10, 5)],
    ]);
    expect(sampleAt(buf, 20, mix, opts)).toEqual(vec(5, 5));
  });

  it('extrapolates briefly past the newest sample, then clamps', () => {
    const buf = buffer([
      [0, vec(0, 0)],
      [50, vec(10, 0)],
    ]);
    expect(sampleAt(buf, 75, mix, opts)).toEqual(vec(15, 0));
    expect(sampleAt(buf, 100, mix, opts)).toEqual(vec(20, 0));
    expect(sampleAt(buf, 400, mix, opts)).toEqual(vec(20, 0));
  });

  it('keeps samples in time order even when they arrive out of order', () => {
    const buf = buffer([
      [0, vec(0, 0)],
      [100, vec(20, 0)],
      [50, vec(10, 0)],
    ]);
    expect(buf.samples.map((s) => s.at)).toEqual([0, 50, 100]);
    expect(sampleAt(buf, 25, mix, opts)).toEqual(vec(5, 0));
  });

  it('a new epoch (floor change) drops the old samples: no sliding across floors', () => {
    const buf = buffer([
      [0, vec(0, 0), 1],
      [50, vec(10, 0), 1],
      [100, vec(500, 500), 2],
    ]);
    expect(buf.samples).toHaveLength(1);
    expect(sampleAt(buf, 75, mix, opts)).toEqual(vec(500, 500));
  });

  it('samples from an older epoch than the buffer are ignored', () => {
    const buf = buffer([
      [100, vec(500, 500), 2],
      [120, vec(1, 1), 1],
    ]);
    expect(buf.samples.map((s) => s.epoch)).toEqual([2]);
  });

  it('snaps instead of sliding across a teleport-sized jump', () => {
    expect(lerpPos(vec(0, 0), vec(200, 0), 0.25, 64)).toEqual(vec(200, 0));
    expect(lerpPos(vec(0, 0), vec(40, 0), 0.25, 64)).toEqual(vec(10, 0));
  });

  it('keeps a bounded number of samples', () => {
    let buf = createBuffer<Vec2>(4);
    for (let i = 0; i < 10; i++) buf = pushSample(buf, { at: i * 50, epoch: 1, value: vec(i, 0) });
    expect(buf.samples.map((s) => s.value.x)).toEqual([6, 7, 8, 9]);
  });
});
