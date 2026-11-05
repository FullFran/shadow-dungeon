import { describe, expect, it } from 'vitest';
import { frameStage, PREVIEW, previewExtent, previewWorld, type Box } from '../../src/app/move-preview';
import { rankedMove } from '../../src/core/rank-effects';
import { MOVES, type MoveId } from '../../src/data/moves';
import { PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';
import { SPRITES, SPRITE_KEYS } from '../../src/data/sprites';

const ASPECTS = [16 / 10, 1, 3, 1100 / 70];
const contains = (outer: Box, inner: Box, eps = 1e-6): boolean =>
  inner.x >= outer.x - eps && inner.y >= outer.y - eps && inner.x + inner.width <= outer.x + outer.width + eps && inner.y + inner.height <= outer.y + outer.height + eps;

/** The idle sprite of `sprite` standing at (x, y), as the renderer draws it. */
function spriteBox(sprite: string, x: number, y: number): Box {
  const meta = SPRITES.sprites[SPRITE_KEYS[sprite as keyof typeof SPRITE_KEYS]]!.anims.Idle!;
  const anchor = meta.anchor ?? { x: meta.frameWidth / 2, y: meta.frameHeight * 0.75 };
  return { x: x - anchor.x, y: y - anchor.y, width: meta.frameWidth, height: meta.frameHeight };
}

describe('preview framing', () => {
  it('every move of every species is framed whole at every stage aspect', () => {
    for (const species of PLAYABLE_SPECIES) {
      for (const move of SPECIES[species].movepool as readonly MoveId[]) {
        for (const rank of [0, 3]) {
          const world = previewWorld(species, move, rank)!;
          const p = world.player.pos;
          const d = world.enemies[0]!.pos;
          const def = rankedMove(move, rank);
          const must: Box[] = [spriteBox(SPECIES[species].sprite, p.x, p.y), spriteBox('koffing', d.x, d.y)];
          const hb = def.hitbox;
          if (hb.kind === 'arc') {
            const r = hb.range * Math.max(1, ...(MOVES[move].charge ?? []).map((c) => c.sizeMultiplier));
            // A sector facing +x (the dummy stands to the right): the ring, or the part of it the cone covers.
            const half = (hb.arcDegrees * Math.PI) / 360;
            const spread = r * Math.sin(Math.min(half, Math.PI / 2));
            const back = Math.min(0, r * Math.cos(half));
            must.push({ x: p.x + back, y: p.y - spread, width: r - back, height: 2 * spread });
          }
          if (hb.kind === 'dash') must.push({ x: p.x, y: p.y - hb.radius, width: hb.distance, height: 2 * hb.radius });
          const extent = previewExtent(species, move, rank);
          for (const box of must) expect(contains(extent, box), `${species} ${move} r${rank}: extent misses ${JSON.stringify(box)}`).toBe(true);
          for (const aspect of ASPECTS) {
            const view = frameStage(extent, aspect);
            expect(Math.abs(view.width / view.height - aspect), `${species} ${move} aspect`).toBeLessThan(1e-6);
            expect(contains(view, extent), `${species} ${move} r${rank} @${aspect.toFixed(1)}: view ${JSON.stringify(view)} cuts ${JSON.stringify(extent)}`).toBe(true);
          }
        }
      }
    }
  });

  it('never looks past the floor of the preview room at the stage aspects the screens use', () => {
    const room: Box = { x: 0, y: 0, width: PREVIEW.arena.width, height: PREVIEW.arena.height };
    for (const species of PLAYABLE_SPECIES) {
      for (const move of SPECIES[species].movepool as readonly MoveId[]) {
        for (const aspect of [16 / 10, 2.5]) expect(contains(room, frameStage(previewExtent(species, move, 3), aspect)), `${species} ${move} @${aspect}`).toBe(true);
      }
    }
  });

  it('keeps a margin around the extent and never zooms in absurdly on a tiny move', () => {
    const view = frameStage({ x: 140, y: 95, width: 20, height: 10 }, 16 / 10);
    expect(view.width).toBeGreaterThanOrEqual(120);
    const tight = frameStage({ x: 0, y: 0, width: 100, height: 50 }, 16 / 10);
    expect(tight.width).toBeGreaterThan(100);
  });
});
