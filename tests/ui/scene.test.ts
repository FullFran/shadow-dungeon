import { describe, expect, it } from 'vitest';
import { sceneLayers, type Scene } from '../../src/ui/scene';

/** Owner, 2026-11-04: "in game los menús salen como dialog sobre el juego. Solo en inicio sale el fondo de inicio." */
describe('scene layers', () => {
  it('the title backdrop shows only in the title scene', () => {
    const scenes: Scene[] = ['title', 'game'];
    for (const scene of scenes) {
      for (const frame of [true, false]) expect(sceneLayers(scene, frame).backdrop, `${scene} ${frame}`).toBe(scene === 'title');
    }
  });

  it('in the game scene the last frame stays under the dialog when there is one, never in the title', () => {
    expect(sceneLayers('game', true).frozenGame).toBe(true);
    expect(sceneLayers('game', false).frozenGame).toBe(false);
    expect(sceneLayers('title', true).frozenGame).toBe(false);
  });
});
