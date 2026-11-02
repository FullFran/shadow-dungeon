import { describe, expect, it } from 'vitest';
import { WORLD } from '../../src/data/world';
import { NPC_SERVICE, PLACE_SERVICES, TOWN_SERVICES } from '../../src/town/town-menu';
import { looseServices, stepMarker, townMapMarkers, type TownMapMarker } from '../../src/town/town-map';

// odd/tasks/menu-redesign.md S8: "el menu del pueblo al pulsar esc se puede hacer que se vea como un minimapa
// moviendote entre los distintos npc para usar su menu".
const hub = WORLD.refugio;
const all = new Set(TOWN_SERVICES);

describe('town map markers', () => {
  it('puts one marker on every NPC with a service and on every place of the hub', () => {
    const markers = townMapMarkers(hub, all);
    for (const npc of hub.npcs.filter((n) => n.opens)) {
      expect(markers.find((m) => m.id === npc.id), npc.id).toMatchObject({ service: NPC_SERVICE[npc.opens!], x: npc.x + 0.5, y: npc.y + 0.5 });
    }
    for (const place of ['board', 'waystone', 'shrine', 'beacon'] as const) {
      const at = hub[place]!;
      expect(markers.find((m) => m.id === place), place).toMatchObject({ service: PLACE_SERVICES[place][0], x: at.x, y: at.y });
    }
  });

  it('leaves out the markers whose service is not wired here (a room has no pillar window)', () => {
    const markers = townMapMarkers(hub, new Set([...all].filter((s) => s !== 'online')));
    expect(markers.some((m) => m.service === 'online')).toBe(false);
    expect(markers.some((m) => m.service === 'shop')).toBe(true);
  });

  it('lists every other available service beside the map, in menu order, none twice', () => {
    const markers = townMapMarkers(hub, all);
    const loose = looseServices(markers, all);
    const onMap = new Set(markers.map((m) => m.service));
    expect(loose.every((s) => !onMap.has(s))).toBe(true);
    expect(new Set([...onMap, ...loose, ...PLACE_SERVICES.waystone])).toEqual(all);
    expect(loose).toEqual(TOWN_SERVICES.filter((s) => loose.includes(s)));
    expect(loose).toContain('pokemon');
  });
});

describe('moving the cursor between markers', () => {
  const at = (id: string, x: number, y: number): TownMapMarker => ({ id, service: 'shop', x, y });
  const markers = [at('centre', 10, 10), at('east', 16, 10), at('far-east', 25, 11), at('north', 10, 4), at('south-east', 14, 16), at('west', 3, 9)];

  it('jumps to the nearest marker in the pressed direction', () => {
    expect(markers[stepMarker(markers, 0, { x: 1, y: 0 })]!.id).toBe('east');
    expect(markers[stepMarker(markers, 0, { x: -1, y: 0 })]!.id).toBe('west');
    expect(markers[stepMarker(markers, 0, { x: 0, y: -1 })]!.id).toBe('north');
    expect(markers[stepMarker(markers, 0, { x: 0, y: 1 })]!.id).toBe('south-east');
  });

  it('stays put when nothing lies that way', () => {
    expect(stepMarker(markers, 3, { x: 0, y: -1 })).toBe(3);
    expect(stepMarker(markers, 2, { x: 1, y: 0 })).toBe(2);
  });

  it('a stick slightly off the axis still picks the marker on that side', () => {
    expect(markers[stepMarker(markers, 0, { x: 0.9, y: 0.3 })]!.id).toBe('east');
  });
});
