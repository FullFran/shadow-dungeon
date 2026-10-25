import { afterEach, describe, expect, it } from 'vitest';
import { hudLine } from '../../src/adapters/hud';
import { emptyLog, eventMessages, LOG, logAlpha, pruneLog, pushMessage, visibleMessages } from '../../src/adapters/message-log';
import { setLanguage } from '../../src/i18n';

describe('message log', () => {
  afterEach(() => setLanguage('es'));

  it('keeps messages oldest first and drops the oldest past the cap', () => {
    let log = emptyLog();
    for (let i = 0; i < LOG.capacity + 2; i++) log = pushMessage(log, `m${i}`, 'info', i * 10);
    expect(log.entries.map((e) => e.text)).toEqual(Array.from({ length: LOG.capacity }, (_, i) => `m${i + 2}`));
    expect(new Set(log.entries.map((e) => e.id)).size).toBe(LOG.capacity);
  });

  it('expires messages after their life, using the injected time only', () => {
    let log = pushMessage(emptyLog(), 'old', 'info', 0);
    log = pushMessage(log, 'new', 'good', 2000);
    expect(pruneLog(log, LOG.lifeMs - 1).entries.map((e) => e.text)).toEqual(['old', 'new']);
    expect(pruneLog(log, LOG.lifeMs).entries.map((e) => e.text)).toEqual(['new']);
    expect(pruneLog(log, 2000 + LOG.lifeMs).entries).toEqual([]);
  });

  it('a message is fully shown, then fades out over its last moments', () => {
    const entry = pushMessage(emptyLog(), 'x', 'info', 1000).entries[0]!;
    expect(logAlpha(entry, 1000)).toBe(1);
    expect(logAlpha(entry, 1000 + LOG.lifeMs - LOG.fadeMs)).toBe(1);
    expect(logAlpha(entry, 1000 + LOG.lifeMs - LOG.fadeMs / 2)).toBeCloseTo(0.5);
    expect(logAlpha(entry, 1000 + LOG.lifeMs)).toBe(0);
    const log = pushMessage(pushMessage(emptyLog(), 'a', 'info', 0), 'b', 'warn', LOG.lifeMs - LOG.fadeMs);
    expect(visibleMessages(log, LOG.lifeMs - LOG.fadeMs / 2)).toEqual([
      { text: 'a', tone: 'info', alpha: expect.closeTo(0.5) },
      { text: 'b', tone: 'warn', alpha: 1 },
    ]);
  });

  it('turns game events into lines: level up, enemy defeated, berry eaten, disguise broken', () => {
    setLanguage('es');
    const lines = eventMessages(
      [
        { type: 'levelUp', level: 5 },
        { type: 'enemyDefeated', enemyId: 'e1' },
        { type: 'berryEaten', berryId: 'b', heal: 20 },
        { type: 'disguiseBroken' },
        { type: 'rollStarted' },
      ],
      (id) => (id === 'e1' ? 'poochyena' : null),
      'mimikyu',
    );
    expect(lines).toEqual([
      { text: '¡Mimikyu subió al nivel 5!', tone: 'level' },
      { text: '¡Poochyena se ha debilitado!', tone: 'good' },
      { text: 'Mimikyu se comió una Baya Aranja y recuperó 20 PS.', tone: 'good' },
      { text: '¡El disfraz se ha roto!', tone: 'warn' },
    ]);
    setLanguage('en');
    expect(eventMessages([{ type: 'enemyDefeated', enemyId: 'e1' }], () => 'gastly', 'mimikyu')).toEqual([{ text: 'Gastly fainted!', tone: 'good' }]);
  });

  it('names the starter in its passive lines and level ups', () => {
    setLanguage('es');
    const lines = eventMessages(
      [
        { type: 'levelUp', level: 3 },
        { type: 'passiveTriggered', passive: 'illusion' },
        { type: 'passiveTriggered', passive: 'flash-fire' },
      ],
      () => null,
      'zorua',
    );
    expect(lines).toEqual([
      { text: '¡Zorua subió al nivel 3!', tone: 'level' },
      { text: '¡La ilusión de Zorua se ha desvanecido!', tone: 'warn' },
      { text: '¡Zorua absorbió el fuego!', tone: 'good' },
    ]);
  });
});

describe('HUD line', () => {
  afterEach(() => setLanguage('es'));

  it('reads like Mystery Dungeon: floor, level and HP rounded up', () => {
    setLanguage('es');
    expect(hudLine(2, 5, 51.2, 100)).toBe('Planta 2 · Nv. 5 · PS 52/100');
    setLanguage('en');
    expect(hudLine(3, 1, 0, 110)).toBe('Floor 3 · Lv. 1 · HP 0/110');
  });
});
