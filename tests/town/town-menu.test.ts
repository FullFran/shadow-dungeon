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

  it('offers changing Pokémon first, alone and in a room', () => {
    expect(townMenuServices(ALL, false)[0]).toBe('pokemon');
    expect(townMenuServices(ALL, true)[0]).toBe('pokemon');
  });

  it('in a room a change of Pokémon reaches the others, on the pick and on leaving', () => {
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    const screen = main.slice(main.indexOf('function pokemonScreen('), main.indexOf('function pokemonScreen(') + 1100);
    expect(screen.match(/repick\?\.\(\)/g)).toHaveLength(2);
    const room = main.slice(main.indexOf('function townLobby('), main.indexOf('function backToRoom('));
    expect(room).toContain('session.repick(settings.species, settings.loadout, skinOn())');
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

  it('the account is a window over the town like the others: it never leaves the town (nor the room)', () => {
    const scene = readFileSync(join(__dirname, '../../src/town/scene.ts'), 'utf8');
    expect(scene).toMatch(/case 'account':\s*return openShopWindow\(options\.openAccount\);/);
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    expect(main.match(/openAccount: townAccount/g)).toHaveLength(2);
    const overlay = main.slice(main.indexOf('function townAccount('), main.indexOf('function townAccount(') + 1200);
    expect(overlay).not.toContain('show(');
    expect(overlay).toContain("h('div', { className: 'town-shop' })");
  });

  it('the gallery is a window over the town like the others, in both towns; the pleas replay only alone and mark nothing', () => {
    const scene = readFileSync(join(__dirname, '../../src/town/scene.ts'), 'utf8');
    expect(scene).toMatch(/case 'gallery':\s*return openShopWindow\(galleryOpener\(\)\);/);
    expect(scene).toContain('open(parent, onClose, lobby ? null : replayPlea)');
    expect(scene).toMatch(/if \(!pleaReplay\) options\.simaPlea\?\.seen\(\);/);
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    expect(main.match(/openGallery: townGallery\(root\)/g)).toHaveLength(2);
    const overlay = main.slice(main.indexOf('function townGallery('), main.indexOf('function galleryCinematic('));
    expect(overlay).not.toContain('show(');
    expect(overlay).toContain("h('div', { className: 'town-shop' })");
    // Replaying writes nothing: no seen flag, save, record or story.
    const player = main.slice(main.indexOf('function galleryCinematic('), main.indexOf('function galleryCinematic(') + 3000);
    for (const write of ['markSeen', 'markSimaSceneSeen', 'markPrologueSeen', 'writeSave', 'recordStory', 'recordHerald', 'saveRun']) expect(player, write).not.toContain(write);
  });

  it('every way into a dungeon (the Esc menu, the waystone, the entrances, the windows) goes through depart, where the Sima pleas wait', () => {
    const scene = readFileSync(join(__dirname, '../../src/town/scene.ts'), 'utf8');
    // The pleas are checked first thing in depart (alone, the first time, heading to the Sima).
    const depart = scene.slice(scene.indexOf('const depart = '), scene.indexOf('// In a room only the host leads'));
    expect(depart).toContain('options.simaPlea.due()');
    expect(depart).toContain('beginPlea(');
    // The Esc menu's "Mazmorras" and the hub's waystone open the destination window, whose rows depart.
    expect(scene).toMatch(/case 'dungeons':\s*return canTravel\(lobby\) \? openExitWindow\(\)/);
    expect(scene).toMatch(/if \(map\.id === HUB && canTravel\(lobby\)\) openExitWindow\(\);/);
    const exit = scene.slice(scene.indexOf('function openExitWindow('), scene.indexOf('function reachEntrance('));
    expect(exit).toContain('enterRows(d.id, d.label, lobby, depart)');
    // Every window over the town (challenges, the menu's services) departs through it too.
    expect(scene).toContain('(id) => depart(id),');
    // The solo town hands the pleas over; the Esc menu never opens over them.
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    expect(main.slice(main.indexOf('function townScreen('), main.indexOf('function tutorView('))).toContain('simaPlea: { dungeon: ECLIPSE.id');
    expect(scene).toMatch(/function openMenu\(\): void \{\s*if \(exitWindow \|\| closeShop \|\| fade \|\| plea \|\| stopped\) return;/);
  });

  it('the solo town wires every service, the room town all but online (the account opens over the town, so the room stays)', () => {
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    const solo = main.slice(main.indexOf('function townScreen('), main.indexOf('function tutorView('));
    const keys: Record<Exclude<TownService, 'travel' | 'dungeons'>, string> = {
      pokemon: 'openPokemon',
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
      gallery: 'openGallery',
      settings: 'openSettings',
    };
    for (const [service, key] of Object.entries(keys)) expect(solo, service).toContain(`${key}:`);
    const room = main.slice(main.indexOf('function townLobby('), main.indexOf('function backToRoom('));
    for (const [service, key] of Object.entries(keys)) if (service !== 'online') expect(room, service).toContain(`${key}:`);
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
