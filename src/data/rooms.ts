import type { SpeciesId } from './species';

/** Axis-aligned rectangle in world pixels (same shape as the core's Rect). */
export interface RoomRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Also stops projectiles (pillars to hide behind). */
  cover?: boolean;
}

export interface RoomDef {
  id: RoomId;
  width: number;
  height: number;
  /** Solid blocks: walkers collide with them, floaters and projectiles ignore them. */
  obstacles: readonly RoomRect[];
  playerStart: { x: number; y: number };
  spawns: readonly { species: SpeciesId; x: number; y: number }[];
  /** Standing here with the room cleared moves on to `next` (null = no exit). */
  exit: RoomRect | null;
  next: RoomId | null;
  /** Toxic pools set into the floor (Toxic Swamp arenas): wading in poisons (core/toxic.ts). */
  pools?: readonly { x: number; y: number; radius: number }[];
}

export type RoomId = 'sandbox' | 'boss' | 'hollow' | 'roost' | 'vault' | 'grotto' | 'wreck' | 'den' | 'rift';

/** M0 rooms: the sandbox with a few enemies, then the Aegislash arena. */
export const ROOMS: Record<RoomId, RoomDef> = {
  sandbox: {
    id: 'sandbox',
    width: 960,
    height: 640,
    obstacles: [
      { x: 300, y: 180, width: 64, height: 64 },
      { x: 600, y: 400, width: 64, height: 64 },
    ],
    playerStart: { x: 160, y: 320 },
    spawns: [
      { species: 'poochyena', x: 520, y: 220 },
      { species: 'poochyena', x: 760, y: 520 },
      { species: 'poochyena', x: 480, y: 560 },
      { species: 'gastly', x: 820, y: 160 },
      { species: 'gastly', x: 700, y: 320 },
    ],
    exit: { x: 900, y: 280, width: 60, height: 80 },
    next: 'boss',
  },
  /** The throne room: four pillars with braziers, cover from Aegislash's thrown blades and shadow swords. */
  boss: {
    id: 'boss',
    width: 800,
    height: 640,
    obstacles: [
      { x: 172, y: 150, width: 56, height: 56, cover: true },
      { x: 572, y: 150, width: 56, height: 56, cover: true },
      { x: 172, y: 400, width: 56, height: 56, cover: true },
      { x: 572, y: 400, width: 56, height: 56, cover: true },
    ],
    playerStart: { x: 400, y: 540 },
    spawns: [{ species: 'aegislash', x: 400, y: 220 }],
    exit: null,
    next: null,
  },
  /**
   * Crypt mid-boss: Sableye's vault, the king's treasury: four heaps of
   * gold to break its lines (they do not stop shots); the stairs on open once
   * it falls.
   */
  vault: {
    id: 'vault',
    width: 720,
    height: 560,
    obstacles: [
      { x: 150, y: 140, width: 52, height: 40 },
      { x: 518, y: 140, width: 52, height: 40 },
      { x: 150, y: 380, width: 52, height: 40 },
      { x: 518, y: 380, width: 52, height: 40 },
    ],
    playerStart: { x: 360, y: 480 },
    spawns: [{ species: 'sableye', x: 360, y: 200 }],
    exit: { x: 320, y: 0, width: 80, height: 50 },
    next: null,
  },
  /** Misty Forest mid-boss: Trevenant's hollow, four old trunks; the path on opens once it falls. */
  hollow: {
    id: 'hollow',
    width: 800,
    height: 640,
    obstacles: [
      { x: 150, y: 150, width: 48, height: 48 },
      { x: 602, y: 150, width: 48, height: 48 },
      { x: 150, y: 430, width: 48, height: 48 },
      { x: 602, y: 430, width: 48, height: 48 },
    ],
    playerStart: { x: 400, y: 560 },
    spawns: [{ species: 'trevenant', x: 400, y: 230 }],
    exit: { x: 360, y: 0, width: 80, height: 50 },
    next: null,
  },
  /**
   * Misty Forest guardian: Decidueye's roost, a clearing about one screen big
   * (so the archer stays in sight) with four old trees whose trunks stop
   * arrows and leaves (cover, like the throne room's pillars).
   */
  roost: {
    id: 'roost',
    width: 640,
    height: 400,
    obstacles: [
      { x: 130, y: 100, width: 36, height: 36, cover: true },
      { x: 474, y: 100, width: 36, height: 36, cover: true },
      { x: 130, y: 260, width: 36, height: 36, cover: true },
      { x: 474, y: 260, width: 36, height: 36, cover: true },
    ],
    playerStart: { x: 320, y: 330 },
    spawns: [{ species: 'decidueye', x: 320, y: 120 }],
    exit: null,
    next: null,
  },
  /**
   * Flooded Caves mid-boss: Lanturn's grotto, a pool of blue light with four
   * crystal-capped rocks that stop its bubbles and sparks (cover); the way on
   * opens at the top once it falls.
   */
  grotto: {
    id: 'grotto',
    width: 680,
    height: 500,
    obstacles: [
      { x: 118, y: 128, width: 62, height: 50, cover: true },
      { x: 500, y: 118, width: 56, height: 58, cover: true },
      { x: 140, y: 330, width: 54, height: 54, cover: true },
      { x: 486, y: 336, width: 62, height: 50, cover: true },
    ],
    playerStart: { x: 340, y: 430 },
    spawns: [{ species: 'lanturn', x: 340, y: 180 }],
    exit: { x: 300, y: 0, width: 80, height: 50 },
    next: null,
  },
  /**
   * Flooded Caves guardian: the sunken ship where Dhelmise keeps watch. The
   * broken hull (bow and stern, long and low) and two rocks are cover: they
   * stop bubbles and kelp in their column, never the anchor.
   */
  wreck: {
    id: 'wreck',
    width: 760,
    height: 540,
    obstacles: [
      { x: 100, y: 170, width: 112, height: 38, cover: true },
      { x: 548, y: 170, width: 112, height: 38, cover: true },
      { x: 170, y: 380, width: 46, height: 46, cover: true },
      { x: 544, y: 380, width: 46, height: 46, cover: true },
    ],
    playerStart: { x: 380, y: 480 },
    spawns: [{ species: 'dhelmise', x: 380, y: 190 }],
    exit: null,
    next: null,
  },
  /**
   * Toxic Swamp mid-boss: Salazzle's den, a clearing of dead roots and two
   * sludge pools in the lower corners; the way on opens at the top once she
   * falls. The roots break her dashes but do not stop shots.
   */
  den: {
    id: 'den',
    width: 800,
    height: 600,
    obstacles: [
      { x: 140, y: 130, width: 44, height: 44 },
      { x: 616, y: 130, width: 44, height: 44 },
      { x: 378, y: 330, width: 44, height: 36 },
    ],
    playerStart: { x: 400, y: 520 },
    spawns: [{ species: 'salazzle', x: 400, y: 190 }],
    exit: { x: 360, y: 0, width: 80, height: 50 },
    next: null,
    pools: [
      { x: 110, y: 480, radius: 46 },
      { x: 690, y: 480, radius: 46 },
    ],
  },
  /**
   * Toxic Swamp guardian: the rift where the sky tore open, Nihilego's arena.
   * Four crystal spires (cover: they stop shards and spores, not the
   * tendrils) and two pools of the poison that fell with it in the far
   * corners.
   */
  rift: {
    id: 'rift',
    width: 760,
    height: 600,
    obstacles: [
      { x: 160, y: 150, width: 48, height: 48, cover: true },
      { x: 552, y: 150, width: 48, height: 48, cover: true },
      { x: 160, y: 402, width: 48, height: 48, cover: true },
      { x: 552, y: 402, width: 48, height: 48, cover: true },
    ],
    playerStart: { x: 380, y: 530 },
    spawns: [{ species: 'nihilego', x: 380, y: 210 }],
    exit: null,
    next: null,
    pools: [
      { x: 56, y: 56, radius: 40 },
      { x: 704, y: 56, radius: 40 },
    ],
  },
};
