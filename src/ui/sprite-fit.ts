import '../styles/sprite-fit.css';

/**
 * Sprite fit rule (.agents/DESIGN.md §4): a Pokémon is drawn from its real idle
 * frame size (`SPRITES.sprites[key].anims.Idle.frameWidth/frameHeight`) and
 * scaled to sit WHOLE inside a box that reserves its headroom, bottom-centred
 * (feet on the ground line). Nothing crops it: no negative margin, no fixed
 * canvas height, no overflow:hidden on the box. In the browser the same rule is
 * the `.sprite-box` class (object-fit: contain, object-position: 50% 100%).
 */
export interface SpriteFit {
  /** Pixels of box per frame pixel. A whole number when the box allows one (crisp pixel art), else fractional. */
  scale: number;
  width: number;
  height: number;
  /** Top-left inside the box: centred horizontally, standing on the bottom edge. */
  x: number;
  y: number;
}

export function spriteFit(frameW: number, frameH: number, boxW: number, boxH: number): SpriteFit {
  const exact = Math.min(boxW / frameW, boxH / frameH);
  const scale = exact >= 1 ? Math.floor(exact) : exact;
  const width = frameW * scale;
  const height = frameH * scale;
  return { scale, width, height, x: (boxW - width) / 2, y: boxH - height };
}

/** One surface that draws a sprite: its stylesheet rule and the box it declares (`minW` is the narrowest the box gets on desktop, `h` its exact height). */
export interface SpriteBox {
  file: string;
  selector: string;
  minW: number;
  h: number;
}

/** Every sprite box in the app; tests/ui/sprite-fit.test.ts fits every playable species and shrine boss in each and checks the stylesheet agrees. */
export const SPRITE_BOXES: readonly SpriteBox[] = [
  { file: 'src/styles/hall.css', selector: '.hl-stage-art', minW: 200, h: 140 },
  { file: 'src/styles/hall.css', selector: '.hl-card-art', minW: 120, h: 92 },
  { file: 'src/styles/species-picker.css', selector: '.sp-stage-sprite', minW: 220, h: 170 },
  { file: 'src/styles/species-picker.css', selector: '.sp-card-art', minW: 120, h: 100 },
  { file: 'src/styles/tutor.css', selector: '.tu-chip-art', minW: 40, h: 40 },
  { file: 'src/styles/evolve-shop.css', selector: '.es-card-art', minW: 120, h: 100 },
  { file: 'src/styles/evolve-shop.css', selector: '.ev-form', minW: 68, h: 100 },
  { file: 'src/styles/challenges.css', selector: '.ch-stage-sprite', minW: 200, h: 160 },
  { file: 'src/styles/loadout-moves.css', selector: '.lm-head-art', minW: 56, h: 64 },
  { file: 'src/styles/pause.css', selector: '.pz-sprite', minW: 112, h: 96 },
  { file: 'src/styles/gacha-page.css', selector: '.gp-own-art', minW: 100, h: 84 },
];
