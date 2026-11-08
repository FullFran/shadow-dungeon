import { describe, expect, it } from 'vitest';
import { orientationBlocks, ROTATE_GATE_KEYS } from '../../src/ui/orientation-gate';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';
import es from '../../src/i18n/es.json';
import en from '../../src/i18n/en.json';

// Owner 2026-11-08: "para móvil hay que hacer que solo se pueda jugar en horizontal por lo que hay que poner un aviso".
describe('orientation gate', () => {
  it('blocks a touch screen held in portrait, on every screen', () => {
    expect(orientationBlocks({ touch: true, width: 390, height: 844 })).toBe(true);
    expect(orientationBlocks({ touch: true, width: 360, height: 640 })).toBe(true);
  });

  it('lets landscape through, and never blocks a desktop (mouse or keyboard) window, however narrow', () => {
    expect(orientationBlocks({ touch: true, width: 844, height: 390 })).toBe(false);
    expect(orientationBlocks({ touch: false, width: 390, height: 844 })).toBe(false);
    expect(orientationBlocks({ touch: true, width: 600, height: 600 })).toBe(false);
  });

  it('has its icon and its texts in both languages', () => {
    expect(PIXEL_ICONS.rotate.rows).toHaveLength(16);
    for (const key of ROTATE_GATE_KEYS) {
      expect((es as Record<string, string>)[key], key).toBeTruthy();
      expect((en as Record<string, string>)[key], key).toBeTruthy();
    }
  });
});
