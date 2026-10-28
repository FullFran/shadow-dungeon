import type { SimaSceneId } from '../data/sima-scenes';

/** What a Sima floor offers for its own scenes (data/sima-scenes.ts), as the game sees it now. */
export interface SimaFloorScenes {
  /** A stratum's threshold scene, on the stratum's first floor. */
  stratum: SimaSceneId | null;
  /** A herald's floor: the first name scene. */
  herald: boolean;
  /** The Eco del Eclipse is in the room: its own shadow scene. */
  ownShadow: boolean;
  /** A lost shadow's floor: someone's shadow (known or not). */
  stray: SimaSceneId | null;
  /** The party still stands behind the floor's fog. */
  fogged: boolean;
}

/**
 * Which scene is due now (odd/tasks/sima-fog-bonfires.md, odd/tasks/shrine-fog.md T2):
 * - on arrival (`entry`): a stratum's threshold; behind a fog, also the lost
 *   shadow's scene, which speaks to the player still deciding whether to
 *   cross (the shadow is optional, with stairs past it: docs/gdd.md);
 * - once the fog is crossed (`crossed`): the boss's own scene (the first
 *   herald, its own shadow), before its cinematic and its music;
 * - a floor without fog plays everything on arrival, in the old order.
 */
export function simaSceneDue(phase: 'entry' | 'crossed', floor: SimaFloorScenes): SimaSceneId | null {
  const boss: SimaSceneId | null = floor.herald ? 'first-name' : floor.ownShadow ? 'own-shadow' : null;
  if (phase === 'crossed') return boss;
  if (floor.fogged) return floor.stratum ?? floor.stray;
  return floor.herald ? boss : (floor.stratum ?? boss ?? floor.stray);
}
