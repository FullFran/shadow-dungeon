import { deriveSeed, nextRandom } from '../rng';

/** A small seeded stream over core/rng.ts for the generator (pure: a value, not a global). */
export class Rand {
  private state: number;
  constructor(seed: number, salt = 0) {
    this.state = deriveSeed(seed, salt);
  }
  next(): number {
    const r = nextRandom(this.state);
    this.state = r.state;
    return r.value;
  }
  /** An integer in [lo, hi]. */
  int(lo: number, hi: number): number {
    return lo + Math.min(hi - lo, Math.floor(this.next() * (hi - lo + 1)));
  }
  /** A float in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.min(items.length - 1, Math.floor(this.next() * items.length))]!;
  }
  /** One of `items` by weight. */
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((s, [, w]) => s + Math.max(0, w), 0);
    let roll = this.next() * total;
    for (const [item, w] of items) {
      roll -= Math.max(0, w);
      if (roll < 0) return item;
    }
    return items[items.length - 1]![0];
  }
}
