import { describe, expect, it } from 'vitest';
import { WORLD } from '../../src/data/world';
import { catalog } from '../../src/i18n';
import { interactKind, interactLabelKey, placeTooltip, TOOLTIP_RISE_MS, TOUCH_MIN, type Box, type InteractKind, type InteractSource } from '../../src/ui/world-tooltip-model';

/** Owner, 2026-11-04: "cuando haya que interactuar, que salga como tooltip cerca de lo que vas a hacer". */
const viewport = { w: 1440, h: 900 };
const size = { w: 160, h: 48 };
const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const boxOf = (p: { x: number; y: number }): Box => ({ x: p.x, y: p.y, w: size.w, h: size.h });

describe('the verb comes from the real interaction kind', () => {
  const cases: [InteractSource, InteractKind][] = [
    [{ kind: 'npc' }, 'talk'],
    [{ kind: 'npc', npc: { opens: 'shop' } }, 'shop'],
    [{ kind: 'npc', npc: { opens: 'tutor' } }, 'learn'],
    [{ kind: 'npc', npc: { opens: 'gacha' } }, 'summon'],
    [{ kind: 'npc', npc: { opens: 'evolve' } }, 'evolve'],
    [{ kind: 'board' }, 'read'],
    [{ kind: 'lore' }, 'read'],
    [{ kind: 'waystone' }, 'travel'],
    [{ kind: 'shrine' }, 'enter'],
    [{ kind: 'beacon' }, 'signal'],
  ];
  for (const [source, kind] of cases) it(`${source.kind}${source.npc?.opens ? ` opening ${source.npc.opens}` : ''} is "${kind}"`, () => expect(interactKind(source)).toBe(kind));

  it('every NPC of every map maps to a verb with a label in Spanish and English', () => {
    const kinds = new Set<InteractKind>();
    for (const map of Object.values(WORLD)) for (const npc of map.npcs) kinds.add(interactKind({ kind: 'npc', npc }));
    for (const kind of [...kinds, ...cases.map((c) => c[1])]) for (const language of ['es', 'en'] as const) expect(catalog(language)[interactLabelKey(kind)], `${language} ${kind}`).toBeTruthy();
  });

  it('the verbs are distinct words', () => {
    const labels = new Set(cases.map(([, kind]) => catalog('es')[interactLabelKey(kind)]));
    expect(labels.size).toBe(new Set(cases.map((c) => c[1])).size);
  });
});

describe('placement', () => {
  const target: Box = { x: 600, y: 400, w: 48, h: 72 };

  it('sits above the target, centred, with the gap, and points at it', () => {
    const p = placeTooltip({ target, size, viewport });
    expect(p.side).toBe('above');
    expect(p.y + size.h).toBe(target.y - 10);
    expect(p.x + size.w / 2).toBe(target.x + target.w / 2);
    expect(p.x + p.arrowX).toBe(target.x + target.w / 2);
  });

  it('clamps to the left and right edges and the arrow still points at the target', () => {
    const left = placeTooltip({ target: { ...target, x: 0 }, size, viewport, margin: 8 });
    expect(left.x).toBe(8);
    expect(left.arrowX).toBeGreaterThan(0);
    expect(left.x + left.arrowX).toBeGreaterThanOrEqual(0);
    const right = placeTooltip({ target: { ...target, x: viewport.w - 20 }, size, viewport, margin: 8 });
    expect(right.x + size.w).toBe(viewport.w - 8);
    expect(right.arrowX).toBeLessThanOrEqual(size.w);
  });

  it('flips below the target at the top edge', () => {
    const p = placeTooltip({ target: { ...target, y: 20 }, size, viewport });
    expect(p.side).toBe('below');
    expect(p.y).toBe(20 + target.h + 10);
  });

  it('never covers the player sprite, wherever the player stands', () => {
    const spots: Box[] = [
      { x: 600, y: 330, w: 48, h: 72 }, // right above the target
      { x: 560, y: 440, w: 48, h: 72 }, // overlapping on the left, below
      { x: 640, y: 380, w: 48, h: 72 }, // on the right
      { x: 620, y: 300, w: 48, h: 72 }, // higher still
    ];
    for (const player of spots) {
      const p = placeTooltip({ target, size, viewport, avoid: player });
      expect(overlaps(boxOf(p), player), JSON.stringify(player)).toBe(false);
      expect(overlaps(boxOf(p), target), JSON.stringify(player)).toBe(false);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + size.w).toBeLessThanOrEqual(viewport.w);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y + size.h).toBeLessThanOrEqual(viewport.h);
    }
  });

  it('stays inside a small phone viewport with the player next to the target', () => {
    const phone = { w: 844, h: 390 };
    const t: Box = { x: 400, y: 180, w: 36, h: 54 };
    const player: Box = { x: 380, y: 120, w: 36, h: 54 };
    const p = placeTooltip({ target: t, size: { w: 140, h: 48 }, viewport: phone, avoid: player });
    expect(overlaps({ x: p.x, y: p.y, w: 140, h: 48 }, player)).toBe(false);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y + 48).toBeLessThanOrEqual(phone.h);
  });
});

describe('timing and touch', () => {
  it('rises in 120 ms and a touch tooltip is at least 44 px', () => {
    expect(TOOLTIP_RISE_MS).toBe(120);
    expect(TOUCH_MIN).toBe(44);
  });
});
