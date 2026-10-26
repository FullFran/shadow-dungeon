import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOWN } from '../../src/data/town';
import { WORLD, type WorldMap } from '../../src/data/world';
import { catalog, LANGUAGES } from '../../src/i18n';
import { NPC_SERVICE, PLACE_SERVICES, serviceAboutKey, serviceLabelKey, TOWN_SERVICES, townMenuServices, type TownService } from '../../src/town/town-menu';

const MAPS = Object.values(WORLD) as WorldMap[];
const ALL = new Set<TownService>(TOWN_SERVICES);

/** The town's Esc menu (owner, 2026-10-26; odd/tasks/fast-travel.md T2). */
describe('town Esc menu', () => {
  it('lists the service of every NPC window in the world', () => {
    const opens = [...TOWN.npcs, ...MAPS.flatMap((m) => m.npcs)].flatMap((n) => (n.opens ? [n.opens] : []));
    expect(opens.length).toBeGreaterThan(0);
    for (const kind of opens) expect(townMenuServices(ALL, false), kind).toContain(NPC_SERVICE[kind]);
  });

  it('lists the service of every place one reads (board, waystone, altar, signal pillar) on every map', () => {
    for (const map of MAPS) {
      const places = (['board', 'waystone', 'shrine', 'beacon'] as const).filter((p) => map[p] !== undefined);
      for (const place of places) for (const service of PLACE_SERVICES[place]) expect(townMenuServices(ALL, false), `${map.id} ${place}`).toContain(service);
    }
  });

  it('lists travel, achievements, account and settings, and keeps the order of TOWN_SERVICES', () => {
    const rows = townMenuServices(ALL, false);
    for (const s of ['travel', 'achievements', 'account', 'settings'] as const) expect(rows).toContain(s);
    expect(rows).toEqual([...TOWN_SERVICES]);
  });

  it('shows only the services the app wired, and no online window inside a room', () => {
    expect(townMenuServices(new Set(['travel', 'shop']), false)).toEqual(['travel', 'shop']);
    expect(townMenuServices(ALL, true)).not.toContain('online');
    expect(townMenuServices(ALL, true)).toHaveLength(TOWN_SERVICES.length - 1);
  });

  it('the scene wires a row action for every service and the way back to the title', () => {
    const scene = readFileSync(join(__dirname, '../../src/town/scene.ts'), 'utf8');
    const actions = scene.slice(scene.indexOf('function serviceAction('), scene.indexOf('const openTownMenu'));
    for (const s of TOWN_SERVICES) expect(actions, s).toContain(`case '${s}':`);
    expect(scene).toMatch(/townMenu\.title'.*leaveTown\(options\.onQuit\)/);
    // Esc on the bare town opens the menu (it no longer leaves at once).
    expect(scene).toMatch(/if \(dialog\) dialog = null;\s*else openMenu\(\);/);
  });

  it('the solo town wires every service, the room town all but the account (it leaves the room) and online', () => {
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    const solo = main.slice(main.indexOf('function townScreen('), main.indexOf('function tutorView('));
    const keys: Record<Exclude<TownService, 'travel' | 'dungeons'>, string> = {
      challenges: 'openChallenges',
      evolve: 'openEvolve',
      shop: 'openShop',
      tutor: 'openTutor',
      gacha: 'openGacha',
      board: 'openBoard',
      achievements: 'openAchievements',
      shrine: 'openShrine',
      online: 'openOnline',
      account: 'openAccount',
      settings: 'openSettings',
    };
    for (const [service, key] of Object.entries(keys)) expect(solo, service).toContain(`${key}:`);
    const room = main.slice(main.indexOf('function townLobby('), main.indexOf('function backToRoom('));
    for (const [service, key] of Object.entries(keys)) if (service !== 'online' && service !== 'account') expect(room, service).toContain(`${key}:`);
  });

  for (const language of LANGUAGES) {
    it(`"${language}" names and describes every service and the closing rows, no em dash`, () => {
      const tr = (key: string) => catalog(language)[key];
      const keys = [...TOWN_SERVICES.flatMap((s) => [serviceLabelKey(s), serviceAboutKey(s)]), 'townMenu.button', 'townMenu.heading', 'townMenu.title', 'townMenu.title.about', 'townMenu.room.about', 'townMenu.resume', 'townMenu.resume.about'];
      for (const key of keys) {
        expect(tr(key), key).toBeTruthy();
        expect(tr(key)!.includes('—'), key).toBe(false);
      }
    });
  }
});
