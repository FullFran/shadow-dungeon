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
}

export type RoomId = 'sandbox' | 'boss' | 'hollow' | 'roost' | 'vault' | 'grotto' | 'wreck';

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
  /** Misty Forest guardian: Decidueye's roost, an open clearing about one screen big, so the archer stays in sight. */
  roost: {
    id: 'roost',
    width: 640,
    height: 400,
    obstacles: [],
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
    width: 760,
    height: 600,
    obstacles: [
      { x: 140, y: 168, width: 64, height: 52, cover: true },
      { x: 556, y: 150, width: 58, height: 60, cover: true },
      { x: 170, y: 410, width: 56, height: 56, cover: true },
      { x: 540, y: 420, width: 64, height: 52, cover: true },
    ],
    playerStart: { x: 380, y: 530 },
    spawns: [{ species: 'lanturn', x: 380, y: 230 }],
    exit: { x: 340, y: 0, width: 80, height: 50 },
    next: null,
  },
  /**
   * Flooded Caves guardian: the sunken ship where Dhelmise keeps watch. The
   * broken hull (bow and stern, long and low) and two rocks are cover: they
   * stop bubbles and kelp in their column, never the anchor.
   */
  wreck: {
    id: 'wreck',
    width: 880,
    height: 680,
    obstacles: [
      { x: 130, y: 230, width: 120, height: 40, cover: true },
      { x: 630, y: 230, width: 120, height: 40, cover: true },
      { x: 200, y: 470, width: 48, height: 48, cover: true },
      { x: 632, y: 470, width: 48, height: 48, cover: true },
    ],
    playerStart: { x: 440, y: 600 },
    spawns: [{ species: 'dhelmise', x: 440, y: 250 }],
    exit: null,
    next: null,
  },
};
