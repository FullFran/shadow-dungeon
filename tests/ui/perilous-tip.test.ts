import { describe, expect, it } from 'vitest';
import { spawnEnemy, createWorld } from '../../src/core/world';
import { vec } from '../../src/core/vec';
import type { WorldState } from '../../src/core/state';
import { AEGISLASH } from '../../src/data/enemies';
import { perilousInSight, perilousTipText, takePerilousTip } from '../../src/ui/perilous-tip';
import { t } from '../../src/i18n';
import { WORDING_DEVICES, wordingKey } from '../../src/ui/device-wording';

/** The one-time perilous tip (odd/tasks/perilous-counter.md S3). */
const base = (): WorldState => createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300) });
const windingUp = (w: WorldState, mode: 'telegraph' | 'attack' | 'idle', elite: boolean): WorldState => {
  const s = spawnEnemy(w, 'poochyena', vec(200, 300), { dormant: true });
  return { ...s, enemies: s.enemies.map((e) => ({ ...e, ...(elite ? { pierceRoll: true as const } : {}), ai: { ...e.ai, mode, modeMs: 0, modeDurationMs: 600 } })) };
};

describe('perilous tip', () => {
  it('a perilous wind-up in the world calls for it (a guest reads the same from its snapshots); an ordinary one does not', () => {
    expect(perilousInSight(windingUp(base(), 'telegraph', true))).toBe(true);
    expect(perilousInSight(windingUp(base(), 'telegraph', false))).toBe(false);
    expect(perilousInSight(windingUp(base(), 'idle', true))).toBe(false);
    expect(perilousInSight(base())).toBe(false);
  });

  it('shows once per device: true the first time (and marks it), then never', () => {
    let seen = false;
    const tip = { seen: () => seen, mark: () => (seen = true) };
    expect(takePerilousTip(tip)).toBe(true);
    expect(seen).toBe(true);
    expect(takePerilousTip(tip)).toBe(false);
    expect(takePerilousTip(undefined)).toBe(false);
  });

  it('has a title and a wording for every device, in both languages, naming the counterstep', () => {
    expect(t('tutorial.perilous.title')).not.toBe('tutorial.perilous.title');
    for (const device of WORDING_DEVICES) {
      const key = wordingKey('tutorial.perilous.keys', device);
      expect(t(key)).not.toBe(key);
      expect(perilousTipText(device)).toContain(t('hud.counter').replace(/[¡!]/g, ''));
    }
    expect(perilousTipText('keys')).not.toContain('{bind:');
  });

  it("Aegislash's Midnight is perilous from Hard: its wind-up calls for the tip there", () => {
    const w0 = { ...base(), difficulty: 'hard' as const };
    const s = spawnEnemy(w0, 'aegislash', vec(200, 300), { dormant: true });
    const boss = { ...s, enemies: s.enemies.map((e) => ({ ...e, boss: { ...e.boss!, stance: 'midnight' as const }, ai: { ...e.ai, mode: 'telegraph' as const, modeMs: 0, modeDurationMs: AEGISLASH.phase2.midnight.telegraphMs } })) };
    expect(perilousInSight(boss)).toBe(true);
  });
});
