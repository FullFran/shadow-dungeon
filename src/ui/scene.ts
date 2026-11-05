/**
 * Which layers sit under a screen (owner, 2026-11-04): the title's eclipse backdrop belongs to the
 * title and the hub only; anything shown during or after a run (menus, the end screen) is a dialog
 * over the frozen last frame of the game, never over the backdrop.
 */
export type Scene = 'title' | 'game';

export interface SceneLayers {
  /** The animated eclipse and town backdrop. */
  backdrop: boolean;
  /** The run's last drawn frame, kept dim under the dialog. */
  frozenGame: boolean;
}

export const sceneLayers = (scene: Scene, hasGameFrame: boolean): SceneLayers => ({ backdrop: scene === 'title', frozenGame: scene === 'game' && hasGameFrame });
