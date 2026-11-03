import { describe, expect, it } from 'vitest';
import { sliderKey, sliderShare, sliderValueAt, type SliderRange } from '../../src/ui/slider-model';

const volume: SliderRange = { min: 0, max: 1, step: 0.05, big: 0.1 };
const opacity: SliderRange = { min: 0.5, max: 1, step: 0.25 };

describe('slider pointer model', () => {
  it('maps a pointer x on the track to a stepped value', () => {
    expect(sliderValueAt(100, 100, 200, volume)).toBe(0);
    expect(sliderValueAt(300, 100, 200, volume)).toBe(1);
    expect(sliderValueAt(200, 100, 200, volume)).toBe(0.5);
    expect(sliderValueAt(131, 100, 200, volume)).toBe(0.15);
  });

  it('clamps outside the track and on a zero-width track', () => {
    expect(sliderValueAt(-50, 100, 200, volume)).toBe(0);
    expect(sliderValueAt(900, 100, 200, volume)).toBe(1);
    expect(sliderValueAt(150, 100, 0, volume)).toBe(0);
  });

  it('snaps to the stops of a coarse range', () => {
    expect(sliderValueAt(100, 100, 200, opacity)).toBe(0.5);
    expect(sliderValueAt(180, 100, 200, opacity)).toBe(0.75);
    expect(sliderValueAt(300, 100, 200, opacity)).toBe(1);
  });

  it('reports the value as a 0..1 share of the track', () => {
    expect(sliderShare(0.75, opacity)).toBe(0.5);
    expect(sliderShare(0, volume)).toBe(0);
    expect(sliderShare(1, volume)).toBe(1);
  });
});

describe('slider keyboard model', () => {
  it('steps with the arrows, without float drift, clamped', () => {
    expect(sliderKey(0.7, 'ArrowRight', volume)).toBe(0.75);
    expect(sliderKey(0.7, 'ArrowLeft', volume)).toBe(0.65);
    expect(sliderKey(0.15, 'ArrowUp', volume)).toBe(0.2);
    expect(sliderKey(0.2, 'ArrowDown', volume)).toBe(0.15);
    expect(sliderKey(1, 'ArrowRight', volume)).toBe(1);
    expect(sliderKey(0, 'ArrowLeft', volume)).toBe(0);
  });

  it('jumps by the big step with PageUp / PageDown and to the ends with Home / End', () => {
    expect(sliderKey(0.5, 'PageUp', volume)).toBe(0.6);
    expect(sliderKey(0.5, 'PageDown', volume)).toBe(0.4);
    expect(sliderKey(0.95, 'PageUp', volume)).toBe(1);
    expect(sliderKey(0.5, 'Home', volume)).toBe(0);
    expect(sliderKey(0.5, 'End', volume)).toBe(1);
  });

  it('ignores other keys', () => {
    expect(sliderKey(0.5, 'a', volume)).toBeNull();
    expect(sliderKey(0.5, 'Enter', volume)).toBeNull();
  });

  it('steps a coarse range by its stops', () => {
    expect(sliderKey(0.5, 'ArrowRight', opacity)).toBe(0.75);
    expect(sliderKey(1, 'ArrowLeft', opacity)).toBe(0.75);
  });
});
