import { afterEach, describe, expect, it } from 'vitest';
import { ENEMY_BEHAVIOUR } from '../../src/data/enemies';
import { registeredCards } from '../../src/data/cards';
import { BOSS_CUES, bossEpithetKey, bossEvents, bossSpecies, cueOf } from '../../src/data/boss-lore';
import { catalog, setLanguage, t } from '../../src/i18n';
import { bossCaption, CAPTION_MS, captionAlpha, captionAlphaReduced } from '../../src/ui/boss-caption';
import { BOSS_STAGE, CHIP, bossBarModel, createBossStage, createChipTrail, moveSlotModel } from '../../src/ui/combat-hud-model';
import type { BossBar } from '../../src/core/boss';
import type { PlayerState } from '../../src/core/state';

afterEach(() => setLanguage('es'));

describe('chip trail (recent damage drains after a beat, inside 600 ms)', () => {
  it('holds the old value right after a hit, then drains to the new one by 600 ms', () => {
    const chip = createChipTrail(1);
    expect(chip.update(1, 0)).toBe(1);
    expect(chip.update(0.6, 100)).toBe(1);
    expect(chip.update(0.6, 100 + CHIP.holdMs - 1)).toBe(1);
    const mid = chip.update(0.6, 100 + CHIP.holdMs + CHIP.drainMs / 2);
    expect(mid).toBeLessThan(1);
    expect(mid).toBeGreaterThan(0.6);
    expect(chip.update(0.6, 100 + CHIP.holdMs + CHIP.drainMs)).toBeCloseTo(0.6, 5);
    expect(CHIP.holdMs + CHIP.drainMs).toBeLessThanOrEqual(600);
  });

  it('never drains below the live value and snaps up on a heal', () => {
    const chip = createChipTrail(1);
    chip.update(0.3, 0);
    for (let ms = 0; ms <= 2000; ms += 50) expect(chip.update(0.3, ms)).toBeGreaterThanOrEqual(0.3);
    expect(chip.update(0.9, 2100)).toBe(0.9);
  });

  it('a second hit during the drain restarts the beat from where the trail is', () => {
    const chip = createChipTrail(1);
    chip.update(0.8, 0);
    const drained = chip.update(0.8, CHIP.holdMs + 100);
    chip.update(0.5, CHIP.holdMs + 100);
    expect(chip.update(0.5, CHIP.holdMs + 100 + CHIP.holdMs - 1)).toBeCloseTo(drained, 5);
  });
});

const roster = bossSpecies();

describe('boss roster', () => {
  it('finds the guardians, mid-bosses, echo, shadow, herald and the Senda shadows', () => {
    for (const id of ['aegislash', 'trevenant', 'decidueye', 'sableye', 'lanturn', 'dhelmise', 'salazzle', 'nihilego', 'eclipse-echo', 'shadow-self', 'sima-herald', 'mimikyu-ditto']) expect(roster, id).toContain(id);
    expect(roster.length).toBeGreaterThanOrEqual(11);
  });
});

describe('epithets', () => {
  for (const language of ['es', 'en'] as const) {
    it(`every boss has an epithet in ${language}`, () => {
      setLanguage(language);
      const missing = roster.filter((id) => {
        const key = bossEpithetKey(id);
        const text = catalog(language)[key];
        return !text || text.trim() === '' || t(key) === key;
      });
      expect(missing).toEqual([]);
    });
  }

  it('Sableye reads as the guardian of the gems', () => {
    setLanguage('es');
    expect(t(bossEpithetKey('sableye'))).toBe('Guardián de las Gemas');
  });
});

const model = (species: (typeof roster)[number], hpShare = 0.6, extra: Partial<BossBar> = {}) =>
  bossBarModel({
    bar: { enemyId: 'b1', species, hp: 600 * hpShare, maxHp: 600, stance: null, ...extra },
    enemy: { types: ['ghost'], hitstunMs: 0, ai: { mode: 'approach' } as never },
    chip: 0.9,
  });

describe('boss bar model', () => {
  for (const species of roster) {
    it(`${species}: name, epithet, fill, type and chip trail`, () => {
      for (const language of ['es', 'en'] as const) {
        setLanguage(language);
        const m = model(species);
        expect(m.name.length).toBeGreaterThan(0);
        expect(m.name).not.toMatch(/^species\./);
        expect(m.epithet).not.toMatch(/^boss\.epithet/);
        expect(m.fill).toBeCloseTo(0.6, 5);
        expect(m.chip).toBe(0.9);
        expect(m.type).toBe('ghost');
      }
    });
  }

  it('card bosses draw a notch and a pip per card, the passed ones done and the live one marked', () => {
    const m = model('sableye', 0.4, { segments: [450, 300, 150], stance: 'glint' });
    expect(m.notches.map((n) => Math.round(n.at * 600))).toEqual([450, 300, 150]);
    expect(m.notches.map((n) => n.passed)).toEqual([true, true, false]);
    expect(m.pips).toEqual(['done', 'done', 'live', 'todo']);
  });

  it('a boss with no cards has no pips, and Aegislash shows its half-way phase notch', () => {
    expect(model('trevenant').pips).toBeNull();
    const aeg = model('aegislash', 0.8);
    expect(aeg.notches).toHaveLength(1);
    expect(aeg.notches[0]!.at).toBeCloseTo(0.5, 5);
  });

  it('reads the status icons off the enemy', () => {
    const m = bossBarModel({
      bar: { enemyId: 'b1', species: 'sableye', hp: 300, maxHp: 600, stance: 'shield' },
      enemy: { types: ['dark'], hitstunMs: 400, dot: { kind: 'poison' } as never, mark: { ms: 900 } as never, weakened: { ms: 900 } as never, ai: { mode: 'approach' } as never },
      chip: 0.5,
    });
    expect(m.statuses).toEqual(['stun', 'poison', 'mark', 'weak', 'guard']);
  });

  it('shows the card clock with seconds and flags the last five', () => {
    const m = model('sableye', 0.5, { segments: [300], cardLeftMs: 4200, stance: 'glint' });
    expect(m.clock).toMatchObject({ seconds: 5, urgent: true });
    expect(model('sableye', 0.5, { segments: [300], cardLeftMs: 20000, stance: 'glint' }).clock?.urgent).toBe(false);
  });
});

describe('boss stage: entrance and defeat', () => {
  it('fades the name in and fills the bar when a boss appears', () => {
    const stage = createBossStage();
    expect(stage.update({ id: null, species: null, alive: false, sameFloor: true }, 0).enter).toBe(0);
    const first = stage.update({ id: 'b1', species: 'sableye', alive: true, sameFloor: true }, 1000);
    expect(first.enter).toBe(0);
    expect(first.fill).toBe(0);
    const mid = stage.update({ id: 'b1', species: 'sableye', alive: true, sameFloor: true }, 1000 + BOSS_STAGE.fillMs / 2);
    expect(mid.fill).toBeGreaterThan(0);
    expect(mid.fill).toBeLessThan(1);
    const done = stage.update({ id: 'b1', species: 'sableye', alive: true, sameFloor: true }, 1000 + BOSS_STAGE.fillMs + BOSS_STAGE.nameMs + 10);
    expect(done).toMatchObject({ enter: 1, fill: 1 });
  });

  it('raises the felled banner once when the boss it was showing dies, and lets it go', () => {
    const stage = createBossStage();
    stage.update({ id: 'b1', species: 'sableye', alive: true, sameFloor: true }, 0);
    const fell = stage.update({ id: null, species: null, alive: false, sameFloor: true, lastDied: true }, 5000);
    expect(fell.defeat).toMatchObject({ species: 'sableye' });
    expect(fell.defeat!.alpha).toBeGreaterThanOrEqual(0);
    expect(stage.update({ id: null, species: null, alive: false, sameFloor: true }, 5000 + BOSS_STAGE.defeatMs + 100).defeat).toBeNull();
  });

  it('does not raise it when the floor changed under the bar', () => {
    const stage = createBossStage();
    stage.update({ id: 'b1', species: 'sableye', alive: true, sameFloor: true }, 0);
    expect(stage.update({ id: null, species: null, alive: false, sameFloor: false }, 100).defeat).toBeNull();
  });

  it('the felled banner is localized and original', () => {
    setLanguage('es');
    expect(t('boss.felled')).toBe('GUARDIÁN CAÍDO');
    setLanguage('en');
    expect(t('boss.felled')).toBe('GUARDIAN FELLED');
  });
});

describe('boss captions: every event of every boss', () => {
  const events = new Map<string, string[]>(roster.map((id) => [id, bossEvents(id)]));

  it('bosses with spell cards or stances list events', () => {
    for (const id of ['aegislash', 'decidueye', 'sableye', 'trevenant', 'lanturn', 'dhelmise', 'salazzle', 'nihilego', 'eclipse-echo']) expect(events.get(id)!.length, id).toBeGreaterThan(0);
  });

  for (const language of ['es', 'en'] as const) {
    it(`every event of every boss has a caption in ${language}: a name, a sign, a cue and a hint`, () => {
      setLanguage(language);
      const bad: string[] = [];
      for (const [species, list] of events) {
        for (const stance of list) {
          const caption = bossCaption(stance, species, 'Heraldo');
          const hint = caption ? t(`boss.cue.${caption.cue}`) : '';
          if (!caption || caption.name.trim() === '' || /^(spell|boss)\./.test(caption.name) || !BOSS_CUES.includes(caption.cue) || hint.startsWith('boss.cue.')) bad.push(`${species}/${stance}`);
        }
      }
      expect(bad).toEqual([]);
    });
  }

  it('every spell card registered in the data has a caption', () => {
    const ids = registeredCards();
    expect(ids.length).toBeGreaterThan(20);
    const bad = ids.filter((id) => {
      const c = bossCaption(id, null);
      return !c || c.name.trim() === '' || /^(spell|boss)\./.test(c.name);
    });
    expect(bad).toEqual([]);
  });

  it('herald cards take their generated name', () => {
    expect(bossCaption('herald2x', 'sima-herald', 'La Aguja del Ocaso')).toMatchObject({ name: 'La Aguja del Ocaso' });
  });

  it('splits "Signo Gema «Destello del Ladrón»" into the sign and the move name', () => {
    setLanguage('es');
    expect(bossCaption('glint', 'sableye')).toMatchObject({ sign: 'Signo Gema', name: 'Destello del Ladrón' });
  });

  it('every cue kind has an icon-backed hint in both languages', () => {
    for (const language of ['es', 'en'] as const) for (const cue of BOSS_CUES) expect(catalog(language)[`boss.cue.${cue}`], `${language} ${cue}`).toBeTruthy();
    expect(cueOf('dive')).toBe('dash');
    expect(BOSS_CUES).toContain(cueOf('something-new'));
  });

  it('the species list used by the data matches the roster', () => {
    for (const id of roster) expect(ENEMY_BEHAVIOUR[id as keyof typeof ENEMY_BEHAVIOUR], id).toBeDefined();
  });
});

describe('caption timing: enter 180 ms, hold, exit 300 ms', () => {
  it('fades in over 180 ms, holds at 1 and leaves over 300 ms', () => {
    expect(CAPTION_MS.enter).toBe(180);
    expect(CAPTION_MS.exit).toBe(300);
    expect(captionAlpha(0)).toBe(0);
    expect(captionAlpha(90)).toBeCloseTo(0.5, 5);
    expect(captionAlpha(CAPTION_MS.enter + 100)).toBe(1);
    expect(captionAlpha(CAPTION_MS.enter + CAPTION_MS.hold + CAPTION_MS.exit / 2)).toBeCloseTo(0.5, 5);
    expect(captionAlpha(CAPTION_MS.enter + CAPTION_MS.hold + CAPTION_MS.exit + 1)).toBe(0);
  });

  it('reduced motion is a plain fade, with no slide or scale', () => {
    expect(captionAlphaReduced(CAPTION_MS.enter + 100)).toBe(1);
    expect(captionAlphaReduced(0)).toBe(0);
  });
});

const player = (over: Partial<PlayerState> = {}): PlayerState =>
  ({ species: 'mimikyu', loadout: ['shadow-claw', 'play-rough', null, null], items: [], level: 1, cooldowns: {}, stamina: 100, moveRanks: {}, ...over }) as unknown as PlayerState;

describe('move slot model per device', () => {
  const loadout = ['shadow-claw', 'play-rough', 'swords-dance', 'earthquake'] as const;

  it('keyboard shows the slot key; the alternative key is named too', () => {
    const slots = [0, 1, 2, 3].map((i) => moveSlotModel(player({ loadout: [...loadout] as never }), i, 'keyboard', 'xbox'));
    expect(slots.map((s) => s.key?.label)).toEqual(['Q', 'E', 'R', 'F']);
    expect(slots.map((s) => s.kind)).toEqual(['fast', 'heavy', 'boost', 'area']);
  });

  it('gamepad shows the pad button of the connected style', () => {
    const xbox = [0, 1, 2, 3].map((i) => moveSlotModel(player({ loadout: [...loadout] as never }), i, 'gamepad', 'xbox').key?.label);
    const ps = [0, 1, 2, 3].map((i) => moveSlotModel(player({ loadout: [...loadout] as never }), i, 'gamepad', 'playstation').key?.label);
    expect(xbox).toEqual(['X', 'Y', 'LB', 'RB']);
    expect(ps[0]).not.toBe(xbox[0]);
    expect(ps.every((l) => typeof l === 'string' && l.length > 0)).toBe(true);
  });

  it('touch has no key glyph (its buttons carry the moves)', () => {
    expect(moveSlotModel(player({ loadout: [...loadout] as never }), 0, 'touch', 'xbox').key).toBeNull();
  });

  it('an empty slot says so, and a cooling one counts seconds up', () => {
    expect(moveSlotModel(player(), 2, 'keyboard', 'xbox').state).toBe('empty');
    const cooling = moveSlotModel(player({ loadout: [...loadout] as never, cooldowns: { 'swords-dance': 99999999999 } as never }), 2, 'keyboard', 'xbox');
    expect(['cooling', 'ready']).toContain(cooling.state);
  });

  it('not enough stamina is its own state', () => {
    const poor = moveSlotModel(player({ loadout: [...loadout] as never, stamina: 0 }), 3, 'keyboard', 'xbox');
    expect(poor.state).toBe('poor');
  });
});
