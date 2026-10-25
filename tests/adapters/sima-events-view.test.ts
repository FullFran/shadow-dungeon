import { describe, expect, it } from 'vitest';
import type { SimaEventState } from '../../src/core/sima-events';
import { announcedOnEntry, simaNews } from '../../src/adapters/sima-events-view';
import { SIMA_EVENTS } from '../../src/data/sima';
import { catalog } from '../../src/i18n';

const base: SimaEventState = { kind: 'waves', room: 1, rect: { x: 0, y: 0, width: 64, height: 64 }, pos: { x: 32, y: 32 }, done: false, wave: 0 };

describe('Sima event news', () => {
  it('turns changes of the event into log keys, once each', () => {
    expect(simaNews(base, { ...base, wave: 1, sealed: true })).toEqual(['sima.log.waves.start']);
    expect(simaNews({ ...base, wave: 1 }, { ...base, wave: 2 })).toEqual(['sima.log.waves.next']);
    expect(simaNews({ ...base, wave: 3 }, { ...base, wave: 3, done: true, outcome: 'cleared' })).toEqual(['sima.log.waves.cleared']);
    expect(simaNews({ ...base, wave: 3, done: true, outcome: 'cleared' }, { ...base, wave: 3, done: true, outcome: 'cleared' })).toEqual([]);
    const house: SimaEventState = { ...base, kind: 'monsterHouse' };
    expect(simaNews(house, { ...house, woke: true })).toEqual(['sima.log.monsterHouse.woke']);
    // A new floor's event is not news.
    expect(simaNews(house, { ...base, wave: 1 })).toEqual([]);
  });

  it('every event and outcome it can reach has its line in Spanish', () => {
    const es = catalog('es');
    const outcomes: Record<string, string[]> = {
      vault: ['opened'],
      shrine: ['accepted', 'declined'],
      monsterHouse: ['woke', 'cleared'],
      crystal: ['taken', 'faded'],
      merchant: [],
      nest: ['woke', 'destroyed'],
      waves: ['start', 'next', 'cleared'],
      ambush: ['woke', 'sprung'],
      hunter: ['loosed'],
    };
    for (const { kind } of SIMA_EVENTS.kinds) {
      if (announcedOnEntry(kind)) expect(es[`sima.log.${kind}.here`], kind).toBeTruthy();
      for (const o of outcomes[kind]!) expect(es[`sima.log.${kind}.${o}`], `${kind}.${o}`).toBeTruthy();
    }
    for (const pact of SIMA_EVENTS.shrine.pacts) expect(es[`sima.pact.${pact.id}.name`]).toBeTruthy();
  });
});
