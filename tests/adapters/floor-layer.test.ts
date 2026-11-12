import { describe, expect, it } from 'vitest';
import { CAVES } from '../../src/data/dungeons';
import { ART_THEMES, THEME_SETS } from '../../src/adapters/floor-art';
import { artPalette, drawFloorTile, drawProp, drawWallTile, drawWallTop } from '../../src/adapters/floor-layer';
import { Grid, type Palette } from '../../src/ui/pixel-grid';

/** The dungeon art pass drawn (odd/tasks/dungeon-art-pass.md): pixel art from palette keys only (pixel-craft). */
describe('dungeon floor art', () => {
  it('draws every prop, floor variant and wall piece of every theme from palette keys only', () => {
    for (const theme of ART_THEMES) {
      const missing = new Set<string>();
      const pal = artPalette(CAVES.palette, theme);
      const watched = new Proxy(pal as Record<string, string>, {
        get(target, key: string) {
          if (!(key in target)) missing.add(key);
          return target[key];
        },
      }) as Palette;
      let rects = 0;
      const ctx = { fillRect: () => void rects++, set fillStyle(_v: string) {} } as unknown as CanvasRenderingContext2D;
      const g = new Grid(ctx, watched);
      for (const set of THEME_SETS[theme].props) for (const look of [0.1, 0.6]) drawProp(g, theme, set.kind, 0, 0, look);
      for (let v = 0; v < 6; v++) drawFloorTile(g, theme, v, 0, 0, 0.3);
      const open = { cols: 3, rows: 3, tiles: [0, 0, 0, 0, 1, 0, 0, 1, 0] };
      drawWallTile(g, theme, open, 1, 0);
      drawWallTile(g, theme, open, 0, 1);
      drawWallTop(g, theme, open, 0, 0);
      drawWallTop(g, theme, open, 1, 0);
      expect([...missing], theme).toEqual([]);
      expect(rects, theme).toBeGreaterThan(0);
    }
  });
});
