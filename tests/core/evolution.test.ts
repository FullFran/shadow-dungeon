import { describe, expect, it } from 'vitest';
import { rosterOf } from '../../src/core/collection';
import { canEvolve, evolutionOf, evolve, lineOf, stageBonus, stageOf } from '../../src/core/evolution';
import { playerStats } from '../../src/core/items';
import { validateLoadout } from '../../src/core/loadout';
import { budgetRatio } from '../../src/core/move-power';
import { createPlayer, createWorld } from '../../src/core/world';
import { vec } from '../../src/core/vec';
import { sanitize } from '../../src/app/save';
import { catalog } from '../../src/i18n';
import { MOVES } from '../../src/data/moves';
import { PLAYER_EVOLUTIONS, STAGE_BONUS_CAP } from '../../src/data/player-evolutions';
import { PLAYER_SLOT_LAYOUT } from '../../src/data/slots';
import { isPlayable, isStarter, originalKit, PLAYABLE_SPECIES, SPECIES, STARTER_SPECIES, type SpeciesId } from '../../src/data/species';
import { tutorOffer } from '../../src/data/tutor';
import { SPRITE_KEYS, SPRITES } from '../../src/data/sprites';

const GACHA_LINES: readonly (readonly SpeciesId[])[] = [
  ['abra', 'kadabra', 'alakazam'],
  ['piplup', 'prinplup', 'empoleon'],
  ['shinx', 'luxio', 'luxray'],
  ['axew', 'fraxure', 'haxorus'],
];
/** The starters' canon lines (odd/tasks/roster-parity.md); Mimikyu has none. */
const STARTER_LINES: readonly (readonly SpeciesId[])[] = [
  ['zorua', 'zoroark'],
  ['litwick', 'lampent', 'chandelure'],
  ['cubone', 'marowak'],
];
const LINES = [...GACHA_LINES, ...STARTER_LINES];
const FIRST_FORMS = GACHA_LINES.map((line) => line[0]!);
const GACHA_FORMS = GACHA_LINES.flat();
const EVOLVED_STARTERS = STARTER_LINES.flatMap((line) => line.slice(1));
const EVOLVED_FORMS = LINES.flatMap((line) => line.slice(1));

describe('evolution lines: data', () => {
  it('every form of every line is playable: the starters, the gacha lines, then the starters\' evolved forms', () => {
    expect(PLAYABLE_SPECIES).toEqual([...STARTER_SPECIES, ...GACHA_FORMS, ...EVOLVED_STARTERS]);
    for (const id of [...GACHA_FORMS, ...EVOLVED_STARTERS]) expect(isPlayable(id) && !isStarter(id), id).toBe(true);
  });

  it('chains each line form by form, and only player lines; Mimikyu does not evolve', () => {
    expect(PLAYER_EVOLUTIONS.map((e) => [e.from, e.to])).toEqual(LINES.flatMap((line) => line.slice(1).map((to, i) => [line[i], to])));
    for (const line of LINES) {
      expect(line.map(lineOf)).toEqual(line.map(() => line[0]));
      expect(line.map(stageOf)).toEqual(line.map((_, i) => i));
      expect(evolutionOf(line[line.length - 1]!)).toBeNull();
    }
    expect(evolutionOf('mimikyu')).toBeNull();
    // Every playable species is in exactly one line (or alone, like Mimikyu).
    for (const id of PLAYABLE_SPECIES) expect(LINES.filter((l) => l.includes(id)).length, id).toBe(id === 'mimikyu' ? 0 : 1);
  });

  it.each(FIRST_FORMS)('%s has a kit of one move per slot, equipped by default, inside the starters\' budget', (id) => {
    const species = SPECIES[id];
    expect(originalKit(id).map((m) => MOVES[m].slot)).toEqual(PLAYER_SLOT_LAYOUT);
    expect(species.defaultLoadout).toEqual(originalKit(id));
    expect(validateLoadout(species, PLAYER_SLOT_LAYOUT, species.defaultLoadout)).toEqual([]);
    for (const m of originalKit(id).filter((x) => MOVES[x].slot !== 'boost')) expect(budgetRatio(MOVES[m]), m).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('each evolution keeps the kit, the tutor offer, the loadout and the passive, and unlocks exactly its one new (non-boost) move', () => {
    for (const e of PLAYER_EVOLUTIONS) {
      const from = SPECIES[e.from];
      const to = SPECIES[e.to];
      expect(from.movepool).not.toContain(e.move);
      expect(originalKit(e.to)).toEqual([...originalKit(e.from), e.move]);
      expect(tutorOffer(e.to)).toEqual(tutorOffer(e.from));
      expect([...to.movepool].sort()).toEqual([...from.movepool, e.move].sort());
      expect(to.defaultLoadout).toEqual(from.defaultLoadout);
      expect(to.passive).toBe(from.passive);
      expect(to.speedScale).toBe(from.speedScale);
      expect(MOVES[e.move].slot, e.move).not.toBe('boost');
      expect(to.maxHp).toBe(from.maxHp);
      expect(e.coins).toBeGreaterThan(0);
      expect(Object.values(e.materials).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    }
  });

  it('a later stage costs more and gives more, but never above the hard ceiling; a final form always needs Pesadilla', () => {
    for (const line of LINES) {
      const final = evolutionOf(line[line.length - 2]!)!;
      // User decision 2026-10-26: the first step needs Normal and Difícil, the final one Difícil and Pesadilla (a one-step line's only one is final).
      expect(final.materials).toEqual({ hard: 3, nightmare: 2 });
      expect(stageBonus(line[line.length - 1]!, 1)).toEqual(final.bonus);
      if (line.length < 3) continue;
      const second = evolutionOf(line[0]!)!;
      expect(second.materials).toEqual({ normal: 3, hard: 2 });
      expect(final.coins).toBeGreaterThan(second.coins);
      expect(final.bonus.hp).toBeGreaterThan(second.bonus.hp);
      expect(final.bonus.damage).toBeGreaterThan(second.bonus.damage);
    }
    for (const e of PLAYER_EVOLUTIONS) {
      expect(e.bonus.hp, e.to).toBeLessThanOrEqual(STAGE_BONUS_CAP.solo);
      expect(e.bonus.damage, e.to).toBeLessThanOrEqual(STAGE_BONUS_CAP.solo);
    }
    expect(STAGE_BONUS_CAP.party).toBeLessThan(STAGE_BONUS_CAP.solo);
  });

  it('every playable form has its own sprite with the core sheets, and a name in both languages', () => {
    const sprites = new Set(PLAYABLE_SPECIES.map((id) => SPRITE_KEYS[SPECIES[id].sprite]));
    expect(sprites.size).toBe(PLAYABLE_SPECIES.length);
    for (const key of sprites) expect(SPRITES.sprites[key], key).toBeDefined();
    for (const lang of ['es', 'en'] as const) for (const id of PLAYABLE_SPECIES) expect(catalog(lang)[`species.${id}`], `${lang} ${id}`).toBeTruthy();
  });
});

describe('evolution: stage bonus in a run', () => {
  it('starters and first forms get none: their players are exactly as before', () => {
    for (const id of [...STARTER_SPECIES, ...FIRST_FORMS]) expect(stageBonus(id, 1)).toEqual({ hp: 0, damage: 0 });
    const plain = createPlayer(vec(0, 0), 'mimikyu');
    expect(plain.maxHp).toBe(SPECIES.mimikyu.maxHp);
    expect('stageDamage' in plain).toBe(false);
  });

  it('raises max HP and every hit of an evolved form', () => {
    const abra = createPlayer(vec(0, 0), 'abra');
    const alakazam = createPlayer(vec(0, 0), 'alakazam');
    const { hp, damage } = stageBonus('alakazam', 1);
    expect(alakazam.maxHp).toBe(Math.round(SPECIES.alakazam.maxHp * (1 + hp)));
    expect(alakazam.maxHp).toBeGreaterThan(abra.maxHp);
    expect(playerStats(alakazam).damage).toBeCloseTo(playerStats(abra).damage * (1 + damage));
  });

  it('evolved starters play with their stage bonus too', () => {
    for (const id of EVOLVED_STARTERS) {
      expect(stageBonus(id, 1).hp, id).toBeGreaterThan(0);
      expect(createPlayer(vec(0, 0), id).maxHp, id).toBeGreaterThan(SPECIES[lineOf(id)].maxHp);
    }
    expect(EVOLVED_FORMS.every((id) => stageBonus(id, 1).damage > 0)).toBe(true);
  });

  it('is capped lower in a party, so co-op stays fair', () => {
    for (const e of PLAYER_EVOLUTIONS) {
      const party = stageBonus(e.to, 2);
      expect(party.hp).toBeLessThanOrEqual(STAGE_BONUS_CAP.party);
      expect(party.damage).toBeLessThanOrEqual(STAGE_BONUS_CAP.party);
    }
    const solo = createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), species: 'haxorus' }).player;
    const duo = createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), species: 'haxorus', party: 2 }).player;
    expect(duo.maxHp).toBeLessThan(solo.maxHp);
    expect(playerStats(duo).damage).toBeLessThan(playerStats(solo).damage);
  });
});

describe('evolution: evolving an owned species', () => {
  const ready = { coins: 10_000, owned: ['shinx', 'abra'] as SpeciesId[], materials: { abra: { normal: 20, hard: 20, nightmare: 20 } } };

  it('pays its Pokémonedas and materials and replaces the form where it was', () => {
    const cost = evolutionOf('abra')!;
    const next = evolve(ready, 'abra')!;
    expect(next.owned).toEqual(['shinx', 'kadabra']);
    expect(next.coins).toBe(ready.coins - cost.coins);
    expect(next.materials?.abra).toEqual({ normal: 20 - cost.materials.normal!, hard: 20 - cost.materials.hard!, nightmare: 20 });
    expect(rosterOf(next)).toEqual([...STARTER_SPECIES, 'shinx', 'kadabra']);
    const final = evolve(next, 'kadabra')!;
    expect(final.owned).toEqual(['shinx', 'alakazam']);
    expect(evolve(final, 'alakazam')).toBeNull();
  });

  it('carries the Mejoras over to the new form', () => {
    const next = evolve({ ...ready, ranks: { abra: { swift: 2 } } }, 'abra')!;
    expect(next.ranks).toEqual({ kadabra: { swift: 2 } });
  });

  it('refuses without the species, the coins or the materials, changing nothing', () => {
    expect(canEvolve(ready, 'abra')).toBe(true);
    expect(canEvolve(ready, 'piplup')).toBe(false);
    expect(canEvolve(ready, 'shinx')).toBe(false);
    expect(canEvolve({ ...ready, coins: 0 }, 'abra')).toBe(false);
    expect(canEvolve(ready, 'mimikyu')).toBe(false);
    expect(evolve({ ...ready, coins: 0 }, 'abra')).toBeNull();
  });

  it('a starter evolves without being stored: its evolved form replaces it in the roster, Mejoras and bought moves carried', () => {
    const wallet = { coins: 10_000, materials: { zorua: { hard: 3, nightmare: 2 }, litwick: { normal: 3, hard: 5, nightmare: 2 } }, learned: { zorua: ['knock-off'] }, ranks: { zorua: { 'feint-attack': 1 } } } as const;
    expect(canEvolve(wallet, 'zorua')).toBe(true);
    expect(canEvolve(wallet, 'mimikyu')).toBe(false);
    const zoroark = evolve(wallet, 'zorua')!;
    expect(zoroark.owned).toEqual(['zoroark']);
    expect(zoroark.learned).toEqual({ zoroark: ['knock-off'] });
    expect(zoroark.ranks).toEqual({ zoroark: { 'feint-attack': 1 } });
    expect(zoroark.materials?.zorua).toEqual({});
    expect(rosterOf(zoroark)).toEqual(['mimikyu', 'zoroark', 'litwick', 'cubone']);
    expect(canEvolve(zoroark, 'zorua')).toBe(false);
    expect(evolve(zoroark, 'zoroark')).toBeNull();
    const lampent = evolve(zoroark, 'litwick')!;
    const chandelure = evolve(lampent, 'lampent')!;
    expect(chandelure.owned).toEqual(['zoroark', 'chandelure']);
    expect(rosterOf(chandelure)).toEqual(['mimikyu', 'zoroark', 'chandelure', 'cubone']);
    expect(canEvolve(chandelure, 'cubone')).toBe(false);
  });

  it('a higher tier never stands in for a lower one, and the final form needs Pesadilla', () => {
    expect(canEvolve({ ...ready, materials: { abra: { hard: 99, nightmare: 99 } } }, 'abra')).toBe(false);
    const kadabra = { coins: 10_000, owned: ['kadabra'] as SpeciesId[] };
    expect(canEvolve({ ...kadabra, materials: { abra: { normal: 999, hard: 999 } } }, 'kadabra')).toBe(false);
    expect(canEvolve({ ...kadabra, materials: { abra: { hard: 3, nightmare: 1 } } }, 'kadabra')).toBe(false);
    expect(canEvolve({ ...kadabra, materials: { abra: { hard: 3, nightmare: 2 } } }, 'kadabra')).toBe(true);
    expect(evolve({ ...kadabra, materials: { abra: { hard: 3, nightmare: 2 } } }, 'kadabra')!.materials).toEqual({ abra: {} });
  });
});

describe('evolution: the save keeps the collection', () => {
  it('keeps owned forms (one per line), their Mejoras, and materials of first forms only, per tier', () => {
    const save = sanitize({ coins: 0, upgrades: {}, owned: ['kadabra', 'abra', 'axew'], materials: { abra: { normal: 3, hard: 2, easy: 4, nightmare: -1 }, kadabra: { normal: 2 }, axew: { hard: 1.5 }, shinx: {} }, ranks: { kadabra: { swift: 1 } } });
    expect(save.owned).toEqual(['kadabra', 'axew']);
    expect(save.materials).toEqual({ abra: { normal: 3, hard: 2 }, axew: { hard: 1 } });
    expect(save.ranks).toEqual({ kadabra: { swift: 1 } });
  });

  it('keeps an evolved starter\'s form (one per line, never a base starter) and its line\'s materials under the starter', () => {
    const save = sanitize({ coins: 0, upgrades: {}, owned: ['zorua', 'lampent', 'chandelure', 'marowak'], materials: { zorua: { nightmare: 2 }, zoroark: { hard: 1 }, mimikyu: { normal: 1 } }, learned: { zoroark: ['knock-off', 'shadow-claw', 'ember'] }, ranks: { chandelure: { 'hyper-beam': 1 } } });
    expect(save.owned).toEqual(['lampent', 'marowak']);
    // Mimikyu has materials too (its awakening); an evolved form's key is dropped.
    expect(save.materials).toEqual({ zorua: { nightmare: 2 }, mimikyu: { normal: 1 } });
    expect(save.learned).toEqual({ zoroark: ['shadow-claw', 'knock-off'] });
  });

  it('an early v3 save\'s flat count per line reads as Normal materials', () => {
    expect(sanitize({ coins: 0, upgrades: {}, materials: { abra: 3, piplup: 0 } }).materials).toEqual({ abra: { normal: 3 } });
  });
});
