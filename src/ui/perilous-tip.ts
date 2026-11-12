import { fillBindings } from '../adapters/bindings';
import { worldDifficulty } from '../core/difficulty';
import type { WorldState } from '../core/state';
import { pierceZone } from '../core/victim';
import { t } from '../i18n';
import { wordingKey, type WordingDevice } from './device-wording';

/**
 * The one-time tip on perilous attacks (odd/tasks/perilous-counter.md S3):
 * the first time a player sees one wind up (the big red "!"), a sign says
 * what it means: a roll's i-frames will not avoid it; walk out of it, or roll
 * into it just as it lands (the counterstep). Once per device (Settings
 * `perilousTipSeen`), anywhere. Pure: game.ts shows it as a tutorial sign.
 */

/** Some enemy is winding up a perilous attack: what the "!" marks. A guest reads it from the host's snapshots. */
export function perilousInSight(world: Pick<WorldState, 'enemies' | 'difficulty' | 'arena'>): boolean {
  const d = worldDifficulty(world);
  return world.enemies.some((e) => e.alive && e.ai.mode === 'telegraph' && pierceZone(e, d, world.arena) !== null);
}

/** True the first time (and marks it as seen), false after, or when the run has no tip store. */
export function takePerilousTip(tip: { seen(): boolean; mark(): void } | undefined): boolean {
  if (!tip || tip.seen()) return false;
  tip.mark();
  return true;
}

const TIP_KEY = 'tutorial.perilous.keys';

/** The sign's text for the input in use; the keyboard wording names the player's bound roll key. */
export const perilousTipText = (device: WordingDevice): string => (device === 'keys' ? fillBindings(t(TIP_KEY)) : t(wordingKey(TIP_KEY, device)));
