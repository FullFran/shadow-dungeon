import { describe, expect, it } from 'vitest';
import { TOWN_SERVICES } from '../../src/town/town-menu';
import { QUICK_WHEEL, wheelSector, wheelServices } from '../../src/town/quick-wheel';

// odd/tasks/menu-redesign.md S8: "podemos tener el menu circular con tab".
describe('quick wheel', () => {
  it('holds at most eight town services, none twice', () => {
    expect(QUICK_WHEEL.length).toBeLessThanOrEqual(8);
    expect(new Set(QUICK_WHEEL).size).toBe(QUICK_WHEEL.length);
    for (const s of QUICK_WHEEL) expect(TOWN_SERVICES).toContain(s);
  });

  it('shows only the services wired here, in wheel order', () => {
    const shown = wheelServices(new Set(['shop', 'dungeons', 'settings']));
    expect(shown).toEqual(QUICK_WHEEL.filter((s) => ['shop', 'dungeons', 'settings'].includes(s)));
  });

  it('sector 0 is straight up and the rest follow clockwise', () => {
    expect(wheelSector({ x: 0, y: -1 }, 8)).toBe(0);
    expect(wheelSector({ x: 1, y: 0 }, 8)).toBe(2);
    expect(wheelSector({ x: 0, y: 1 }, 8)).toBe(4);
    expect(wheelSector({ x: -1, y: 0 }, 8)).toBe(6);
    expect(wheelSector({ x: 0.7, y: -0.7 }, 8)).toBe(1);
    expect(wheelSector({ x: 1, y: 0 }, 4)).toBe(1);
  });

  it('picks nothing inside the dead zone', () => {
    expect(wheelSector({ x: 0.1, y: 0.1 }, 8)).toBeNull();
    expect(wheelSector({ x: 0, y: 0 }, 8)).toBeNull();
  });
});
