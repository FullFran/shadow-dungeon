import { echoName } from './eclipse-echo-view';
import { heraldBarText } from './herald-vfx';
import type { LastDevice } from './last-device';
import type { PortraitDrawer } from './hud-portrait';
import type { SpellBanner } from './intro-card';
import type { PadStyle } from '../app/gamepad-help-data';
import { bossBar } from '../core/boss';
import type { EnemyState, WorldState } from '../core/state';
import { PLAYER_SLOT_LAYOUT } from '../data/slots';
import { t } from '../i18n';
import { BOSS_CUES, bossCaption, captionMotion, CAPTION_LIFE_MS } from '../ui/boss-caption';
import { cardTipText, resultAlpha, TIP_MS, type CardClockView, type CardResultBanner } from '../ui/card-clock';
import { STAMINA_MAX, bossBarModel, createBossStage, createChipTrail, createCombatFade, createPassiveNote, fightKind, fillOf, moveSlotModel, type BossStage, type BossStatus, type ChipTrail, type CombatFade, type MoveSlotModel, type PassiveNote } from '../ui/combat-hud-model';
import { COMBAT_ICONS, drawIcon } from '../ui/combat-icons';
import { drawPanel, noLigatures } from '../ui/canvas';
import { BOSS_BAR, CARD_CLOCK, HUD_METRICS, bossRect, captionNameSize, cardClockRect, cardTipRect, captionRect, chipsRect, hudVariant, slotRect, statusRect, type HudBox, type HudDims, type HudVariant } from '../ui/hud-layout';
import { canvasFont, PALETTE, RELIC, TIER_COLORS, TYPE_COLORS } from '../ui/tokens';
import { levelProgress } from '../core/progression';
import { passiveStatus, itemsChip, coinsLabel, slotCount } from './hud';

/**
 * The combat HUD (.agents/DESIGN.md §4 "Combat HUD"): the partner status window, the co-op frames, the four relic
 * move slots, the Souls boss bar with its entrance and "felled" banner, and the boss event announcement. Everything
 * here is drawn in HUD space (src/ui/hud-layout.ts); what to draw comes from the pure models in
 * src/ui/combat-hud-model.ts and src/ui/boss-caption.ts, and the only state kept here is presentation (chip trails,
 * the entrance clock), so nothing in it can touch the simulation.
 */

/** Presentation state that outlives a frame: the chip trails and the boss stage. */
export interface CombatHudState {
  /** The player's HP trail, created at the first frame so a run resumed at low HP does not start by draining. */
  hp: ChipTrail | null;
  boss: ChipTrail;
  stage: BossStage;
  partners: Map<string, ChipTrail>;
  /** The boss the bar showed last frame and the arena it was in (a new floor is not a victory). */
  last: { id: string; species: string; arena: unknown } | null;
  /** 0 calm .. 1 fighting: how far the peripheral elements (chips, log, names, hints) have dimmed. */
  fade: CombatFade;
  combat: number;
  /** The passive's state label, shown for 2 s when it changes. */
  passive: PassiveNote;
}

export const createCombatHudState = (): CombatHudState => ({ hp: null, boss: createChipTrail(1), stage: createBossStage(), partners: new Map(), last: null, fade: createCombatFade(), combat: 0, passive: createPassiveNote() });

/** What a frame hands the combat HUD besides the world. */
export interface CombatView {
  nowMs: number;
  state: CombatHudState;
  device: LastDevice;
  pad: PadStyle;
  portrait?: PortraitDrawer;
  names?: ReadonlyMap<string, string>;
  shownAs?: ReadonlyMap<string, string>;
  touch: boolean;
  /** HUD scale (backing px per HUD px): small icons are drawn at one CSS px per art pixel. */
  scale: number;
  floor: number;
  coins?: number;
  /** How the last card ended, while its banner shows (ui/card-clock.ts). */
  cardResult?: CardResultBanner | null;
  /** The one-time card clock tip, while it shows: when it appeared (real ms). */
  cardTip?: { shownAtMs: number } | null;
}

type Ctx = CanvasRenderingContext2D;
type HudSize = { width: number; height: number };

const GOLD: string = PALETTE.border;
/** Pale trail of recent damage: lighter than the bar it drains behind. */
const CHIP_COLOUR = PALETTE.cursor;

/** Text with a full one-pixel outline, for legibility on any floor. */
function outlined(ctx: Ctx, text: string, x: number, y: number, colour: string, size = 11, align: CanvasTextAlign = 'left', weight = 1): void {
  ctx.font = canvasFont(size);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  const shown = noLigatures(text);
  const rx = Math.round(x);
  const ry = Math.round(y);
  ctx.fillStyle = PALETTE.ink;
  for (const [dx, dy] of [[-weight, 0], [weight, 0], [0, -weight], [0, weight], [weight, weight], [-weight, weight], [weight, -weight], [-weight, -weight]] as const) ctx.fillText(shown, rx + dx, ry + dy);
  ctx.fillStyle = colour;
  ctx.fillText(shown, rx, ry);
}

/** Capital letters set apart, the way a Souls boss name is carved: `spacing` HUD px between glyphs. Returns the width drawn. */
function spaced(ctx: Ctx, text: string, x: number, y: number, colour: string, size: number, spacing: number, align: 'left' | 'center' | 'right', alpha = 1): number {
  ctx.font = canvasFont(size);
  const chars = [...noLigatures(text)];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
  const before = ctx.globalAlpha;
  ctx.globalAlpha = before * alpha;
  chars.forEach((c, i) => {
    outlined(ctx, c, cx, y, colour, size, 'left');
    cx += widths[i]! + spacing;
  });
  ctx.globalAlpha = before;
  return total;
}

/** Text squeezed to `maxW` (a horizontal squeeze, not a smaller font, keeps the pixel grid); centred or left. */
function fitted(ctx: Ctx, text: string, x: number, y: number, maxW: number, colour: string, align: 'left' | 'center' = 'left', size = 11): void {
  ctx.font = canvasFont(size);
  const w = ctx.measureText(noLigatures(text)).width;
  if (w <= maxW) {
    outlined(ctx, text, align === 'center' ? x + maxW / 2 : x, y, colour, size, align === 'center' ? 'center' : 'left');
    return;
  }
  const k = Math.max(0.6, maxW / w);
  ctx.save();
  ctx.translate(Math.round(x), 0);
  ctx.scale(k, 1);
  outlined(ctx, text, 0, y, colour, size, 'left');
  ctx.restore();
}

/** The measured width of `text` at `size`. */
function widthOf(ctx: Ctx, text: string, size = 11): number {
  ctx.font = canvasFont(size);
  return ctx.measureText(noLigatures(text)).width;
}

/** A relic bar: dark outline, gilt hairline, inner shade, empty trough, then the trail and the fill. */
function relicBar(ctx: Ctx, x: number, y: number, w: number, h: number, fill: number, chip: number, colour: string, lowColour?: string): void {
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = PALETTE.barBack;
  ctx.fillRect(x, y, w, h);
  const chipW = Math.round(w * Math.min(1, Math.max(0, chip)));
  ctx.fillStyle = CHIP_COLOUR;
  ctx.fillRect(x, y, chipW, h);
  const filled = Math.round(w * Math.min(1, Math.max(0, fill)));
  ctx.fillStyle = lowColour && fill <= 0.3 ? lowColour : colour;
  ctx.fillRect(x, y, filled, h);
  // Volume: a bright top line and a darker lower third on the fill.
  const alpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, filled, 1);
  ctx.globalAlpha = alpha * 0.3;
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x, y + Math.ceil(h * 0.65), filled, h - Math.ceil(h * 0.65));
  ctx.globalAlpha = alpha;
}

/** One gilt finial at the end of the boss bar: a pointed cap, taller than the frame, with an ink outline and a dark stud. */
function finial(ctx: Ctx, cx: number, cy: number, half: number, dir: 1 | -1): void {
  const tip = cx + dir * 3;
  ctx.beginPath();
  ctx.moveTo(cx - dir * 2, cy - half);
  ctx.lineTo(cx + dir * 1, cy - half + 2);
  ctx.lineTo(cx + dir * 1, cy - 3);
  ctx.lineTo(tip + dir * 2, cy);
  ctx.lineTo(cx + dir * 1, cy + 3);
  ctx.lineTo(cx + dir * 1, cy + half - 2);
  ctx.lineTo(cx - dir * 2, cy + half);
  ctx.closePath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(Math.round(cx - 1), Math.round(cy - 1), 2, 2);
}

/**
 * The boss bar in the sombre souls style: a dark iron frame (ink outline, slab body, an engraved inner line), a gilt hairline
 * with corner studs, spiked finials at both ends, the fill in dark blood with a lighter top line, and the damage trail in ember
 * (the only warmth). `thick` is the fill's height; the frame adds 3 HUD px on each side (BOSS_BAR.frame).
 */
function ironBar(ctx: Ctx, x: number, y: number, w: number, thick: number, fill: number, chip: number, colour: string): void {
  const alpha = ctx.globalAlpha;
  // Frame: ink, then iron with a gilt hairline and an engraved inner line (11 HUD px tall in all).
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x - 3, y - 3, w + 6, thick + 6);
  ctx.fillStyle = RELIC.slabEdge;
  ctx.fillRect(x - 2, y - 2, w + 4, thick + 4);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x - 2, y - 2, w + 4, 1);
  ctx.fillRect(x - 2, y + thick + 1, w + 4, 1);
  ctx.fillStyle = PALETTE.borderShade;
  ctx.fillRect(x - 1, y - 1, w + 2, 1);
  ctx.fillRect(x - 1, y + thick, w + 2, 1);
  // Trough, trail, fill.
  ctx.fillStyle = PALETTE.barBack;
  ctx.fillRect(x, y, w, thick);
  const chipW = Math.round(w * Math.min(1, Math.max(0, chip)));
  const filled = Math.round(w * Math.min(1, Math.max(0, fill)));
  if (chipW > filled) {
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = RELIC.ember;
    ctx.fillRect(x + filled, y, chipW - filled, thick);
    ctx.globalAlpha = alpha;
  }
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, filled, thick);
  ctx.globalAlpha = alpha * 0.3;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, filled, 1);
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x, y + thick - 1, filled, 1);
  ctx.globalAlpha = alpha;
  // Corner studs and the finials.
  ctx.fillStyle = GOLD;
  for (const sx of [x - 2, x + w + 1]) for (const sy of [y - 2, y + thick + 1]) ctx.fillRect(sx, sy, 1, 1);
  finial(ctx, x - 6, y + thick / 2, 6, -1);
  finial(ctx, x + w + 6, y + thick / 2, 6, 1);
}

/** A small rank/card diamond with a dark outline. */
function diamond(ctx: Ctx, cx: number, cy: number, r: number, fill: string | null, edge: string): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r - 0.5);
  ctx.lineTo(cx + r + 0.5, cy);
  ctx.lineTo(cx, cy + r + 0.5);
  ctx.lineTo(cx - r - 0.5, cy);
  ctx.closePath();
  ctx.lineWidth = 1;
  ctx.strokeStyle = PALETTE.ink;
  ctx.stroke();
  ctx.fillStyle = fill ?? PALETTE.barBack;
  ctx.fill();
  if (!fill) {
    ctx.strokeStyle = edge;
    ctx.stroke();
  }
}

/** Corner studs: the relic frames' ornament, a 2x2 gilt square inside each corner. */
function studs(ctx: Ctx, x: number, y: number, w: number, h: number, colour = GOLD): void {
  ctx.fillStyle = colour;
  for (const [sx, sy] of [[x + 3, y + 3], [x + w - 5, y + 3], [x + 3, y + h - 5], [x + w - 5, y + h - 5]] as const) ctx.fillRect(sx, sy, 2, 2);
}

/** A key or pad button as a small cap: slab fill, gilt edge, hard drop. */
function keycap(ctx: Ctx, label: string, x: number, y: number, kind: 'key' | 'pad', dim: boolean, h = 12): void {
  const w = Math.max(h + 1, Math.ceil(widthOf(ctx, label)) + 4);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 3);
  ctx.fillStyle = kind === 'pad' ? RELIC.blood : RELIC.slabEdge;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = dim ? PALETTE.borderShade : GOLD;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillStyle = PALETTE.borderShade;
  ctx.fillRect(x, y + h, w, 1);
  ctx.font = canvasFont();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = dim ? PALETTE.textDim : PALETTE.text;
  ctx.fillText(noLigatures(label), Math.round(x + w / 2), y + h - 2);
}

const STATUS_ICON: Record<BossStatus, string> = { stun: 'stun', poison: 'poison', burn: 'flame', mark: 'mark', weak: 'weak', guard: 'shield', held: 'seal' };

// -- Status window -----------------------------------------------------------------------------------------------

/** Sizes of the icons: 16 art pixels at one CSS px each on desktop (so they match the 11 px text), full HUD px on touch. */
interface Ui {
  scale: number;
  /** HUD px per art pixel. */
  u: number;
  /** HUD px of a whole 16x16 icon. */
  s: number;
}

const uiOf = (view: Pick<CombatView, 'scale' | 'touch'>): Ui => (view.touch ? { scale: view.scale, u: 1, s: 16 } : { scale: view.scale, u: 1 / view.scale, s: 16 / view.scale });

/** Snaps a HUD coordinate to a whole backing pixel so a small icon stays crisp. */
const snap = (v: number, scale: number): number => Math.round(v * scale) / scale;

/** One of the pixel icons at its HUD size, its top-left snapped to the pixel grid. */
function smallIcon(ctx: Ctx, name: string, x: number, y: number, ui: Ui, alpha = 1): void {
  drawIcon(ctx, COMBAT_ICONS[name]!, snap(x, ui.scale), snap(y, ui.scale), ui.u, alpha);
}

/** Multiplies the context's alpha by `a` until `restoreAlpha` is called with the value returned. */
const dimBy = (ctx: Ctx, a: number): number => {
  const before = ctx.globalAlpha;
  ctx.globalAlpha = before * a;
  return before;
};

/** The peripheral chips lose this share of their opacity in a fight (they stay at 35%). */
const PERIPHERAL_LOSS = 0.65;

/** The top-left window: portrait with level and XP line, HP bar with its number, a thin stamina bar, the passive as one icon; the chips under it. */
function statusWindow(ctx: Ctx, state: WorldState, screen: HudSize, view: CombatView, combat: number): void {
  const { player } = state;
  const ui = uiOf(view);
  const m = HUD_METRICS[hudVariant(screen)];
  const chipText = itemsChip(player.items.length, view.touch);
  const { x, y, width, height } = statusRect(screen, view.touch);
  drawPanel(ctx, x, y, width, height, { alpha: 0.88 });

  // Portrait: a sprite-fit box, the creature whole; the level and the XP line along its foot.
  const pad = 4;
  const box: HudBox = { x: x + pad, y: y + pad, width: m.portrait, height: m.portrait };
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(box.x - 1, box.y - 1, box.width + 2, box.height + 2);
  const sky = ctx.createLinearGradient(0, box.y, 0, box.y + box.height);
  sky.addColorStop(0, RELIC.slabEdge);
  sky.addColorStop(1, PALETTE.windowBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  view.portrait?.(ctx, player, { x: box.x + 1, y: box.y + 1, width: box.width - 2, height: box.height - 2 }, view.nowMs);
  const strip = 10;
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(box.x, box.y + box.height - strip, box.width, strip);
  ctx.globalAlpha = 1;
  ctx.font = canvasFont();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PALETTE.cursor;
  ctx.fillText(noLigatures(t('hud.status.level').replace('{n}', String(player.level))), Math.round(box.x + box.width / 2), box.y + box.height - 2);
  ctx.fillStyle = PALETTE.barBack;
  ctx.fillRect(box.x, box.y + box.height - 2, box.width, 2);
  ctx.fillStyle = PALETTE.xp;
  ctx.fillRect(box.x, box.y + box.height - 2, Math.round(box.width * levelProgress(player.xp).fill), 2);

  const x0 = box.x + box.width + 5;
  const right = x + width - pad;
  const barX = x0 + Math.ceil(ui.s) + 3;
  const barW = right - barX;

  // HP: the heart, the bar with its chip trail, the number on it.
  const hpFill = fillOf(player.hp, player.maxHp);
  view.state.hp ??= createChipTrail(hpFill);
  const hpChip = view.state.hp.update(hpFill, view.nowMs);
  const hpY = y + 6;
  const hpH = 10;
  smallIcon(ctx, 'heart', x0, hpY + hpH / 2 - ui.s / 2, ui);
  relicBar(ctx, barX, hpY, barW, hpH, hpFill, hpChip, PALETTE.hp, PALETTE.hpLow);
  outlined(ctx, `${Math.ceil(Math.max(0, player.hp))}/${Math.ceil(player.maxHp)}`, barX + barW / 2, hpY + hpH - 2, PALETTE.text, 11, 'center');

  // Stamina: a thin bar right under it, no icon.
  relicBar(ctx, barX, y + 21, barW, 3, fillOf(player.stamina, STAMINA_MAX), 0, PALETTE.stamina);

  // The passive: one small mask icon (bright while ready); its state in words only when it changes, and while idle.
  const passive = passiveStatus(player);
  const noted = view.state.passive.update(passive.text, view.nowMs);
  const rowY = y + 28 + (height - 28) / 2;
  smallIcon(ctx, 'mask', x0, rowY - ui.s / 2, ui, passive.ready ? 1 : 0.45);
  const labelAlpha = noted ? 1 : 1 - combat;
  if (labelAlpha > 0.02) {
    const before = dimBy(ctx, labelAlpha);
    fitted(ctx, passive.text, barX, y + height - 4, right - barX, passive.ready ? PALETTE.cursor : PALETTE.disabled);
    ctx.globalAlpha = before;
  }

  // The chips: floor and coins as tiny icon + number, low opacity in a fight; the held items line only while idle.
  const chips = chipsRect(screen, chipText !== null, view.touch);
  const before = dimBy(ctx, 1 - PERIPHERAL_LOSS * combat);
  const cy = chips.y + m.chipsHeight / 2;
  smallIcon(ctx, 'stairs', chips.x, cy - ui.s / 2, ui);
  outlined(ctx, t('hud.status.floor').replace('{n}', String(view.floor)), chips.x + ui.s + 3, cy + 4, PALETTE.text);
  if (view.coins !== undefined) {
    const label = coinsLabel(view.coins);
    const w = widthOf(ctx, label);
    outlined(ctx, label, chips.x + chips.width, cy + 4, PALETTE.cursor, 11, 'right');
    smallIcon(ctx, 'coin', chips.x + chips.width - w - ui.s - 3, cy - ui.s / 2, ui);
  }
  ctx.globalAlpha = before;
  if (chipText && combat < 0.98) {
    const b = dimBy(ctx, 1 - combat);
    outlined(ctx, chipText, chips.x, chips.y + m.chipsHeight + m.chipHeight - 2, PALETTE.textDim);
    ctx.globalAlpha = b;
  }
}

// -- Co-op frames -------------------------------------------------------------------------------------------------

/** Each partner under the chips: portrait, name, HP; a downed one is dim with a skull. */
function partnerFrames(ctx: Ctx, state: WorldState, screen: HudSize, view: CombatView): void {
  const variant = hudVariant(screen);
  const m = HUD_METRICS[variant];
  const ui = uiOf(view);
  const chips = chipsRect(screen, itemsChip(state.player.items.length, view.touch) !== null, view.touch);
  const status = statusRect(screen, view.touch);
  state.remotes.forEach((remote, i) => {
    const w = m.partnerWidth;
    const h = m.partnerHeight;
    const x = status.x;
    const y = chips.y + chips.height + m.partnerGap + i * (h + m.partnerGap);
    const down = remote.player.hp <= 0;
    drawPanel(ctx, x, y, w, h, { alpha: 0.85, border: down ? PALETTE.borderShade : GOLD });
    const pbox: HudBox = { x: x + 3, y: y + 3, width: h - 6, height: h - 6 };
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(pbox.x - 1, pbox.y - 1, pbox.width + 2, pbox.height + 2);
    view.portrait?.(ctx, remote.player, pbox, view.nowMs, down);
    const name = view.names?.get(remote.id) ?? t(`species.${remote.player.species}`);
    const tx = x + h + 2;
    if (down) {
      const label = t('hud.partner.down');
      const lw = widthOf(ctx, label);
      smallIcon(ctx, 'skull', x + w - 4 - ui.s, y + h / 2 - ui.s / 2, ui, 0.85);
      outlined(ctx, label, x + w - ui.s - 7, y + 14, PALETTE.disabled, 11, 'right');
      fitted(ctx, name, tx, y + 14, w - h - 8 - lw - ui.s - 4, PALETTE.disabled);
      return;
    }
    fitted(ctx, name, tx, y + 10, w - h - 6, PALETTE.text);
    let trail = view.state.partners.get(remote.id);
    const fill = fillOf(remote.player.hp, remote.player.maxHp);
    if (!trail) {
      trail = createChipTrail(fill);
      view.state.partners.set(remote.id, trail);
    }
    const chip = trail.update(fill, view.nowMs);
    const bw = w - h - 8;
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(tx - 1, y + h - 7, bw + 2, 5);
    ctx.fillStyle = PALETTE.barBack;
    ctx.fillRect(tx, y + h - 6, bw, 3);
    ctx.fillStyle = CHIP_COLOUR;
    ctx.fillRect(tx, y + h - 6, Math.round(bw * chip), 3);
    ctx.fillStyle = fill <= 0.3 ? PALETTE.hpLow : PALETTE.hp;
    ctx.fillRect(tx, y + h - 6, Math.round(bw * fill), 3);
  });
}

// -- Move slots ---------------------------------------------------------------------------------------------------

const SLOT_ICON = ['slotFast', 'slotHeavy', 'slotBoost', 'slotArea'] as const;

/** A slot: the move's icon centred, its key glyph in a corner cap and the cooldown sweep; ranks as tiny pips. Names show elsewhere (idle list, pause). */
function slotWindow(ctx: Ctx, model: MoveSlotModel, box: HudBox, nowMs: number, ui: Ui): void {
  const { x, y, width: s } = box;
  const empty = model.state === 'empty';
  const colours = model.type ? TYPE_COLORS[model.type] : null;
  const border = model.state === 'busy' ? PALETTE.cursor : model.glowing && colours ? colours.core : model.state === 'poor' ? PALETTE.danger : empty ? PALETTE.borderShade : GOLD;
  drawPanel(ctx, x, y, s, s, { alpha: empty ? 0.45 : 0.82, border });
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 2, y + 2, s - 4, s - 4);
  ctx.clip();
  if (colours) {
    // The move's type: a thin band along the top and a faint wash behind the icon.
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = colours.core;
    ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colours.core;
    ctx.fillRect(x + 2, y + 2, s - 4, 2);
  }
  const dim = model.state === 'cooling' || empty;
  // The move's icon, about 26 CSS px, centred a little low and right so the key's corner cap never touches it.
  const big: Ui = { scale: ui.scale, u: 26 / 16 / ui.scale, s: 26 / ui.scale };
  smallIcon(ctx, SLOT_ICON[model.index] ?? 'slotFast', x + (s - big.s) / 2 + s * 0.05, y + (s - big.s) / 2 + s * 0.1, big, dim ? 0.5 : 1);
  if (model.state === 'poor') {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = PALETTE.hpLow;
    ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
    ctx.globalAlpha = 1;
  }
  if (model.cooldown) {
    // The sweep: the share still to run stays dark, clockwise from the top.
    const cx = x + s / 2;
    const cy = y + s / 2;
    ctx.fillStyle = 'rgba(5, 4, 7, 0.72)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * model.cooldown.fill, false);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  if (model.cooldown) outlined(ctx, String(model.cooldown.seconds), x + s / 2, y + s / 2 + 4, PALETTE.cursor, 11, 'center');
  if (empty) return;
  // The key glyph in its own cap in the top-left corner, whole (owner 2026-11-04: it was clipped over the icon).
  if (model.key) keycap(ctx, model.key.label, x + 2, y + 2, model.key.kind, dim, 11);
  // Mejoras: the rank as tiny squares in the move's tier colour, bottom right.
  if (model.rank) {
    for (let i = 0; i < model.rank.max; i++) {
      const px = x + s - 4 - (model.rank.max - i) * 4;
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(px - 1, y + s - 7, 4, 4);
      ctx.fillStyle = i < model.rank.filled ? TIER_COLORS[model.rank.tier] : PALETTE.barBack;
      ctx.fillRect(px, y + s - 6, 2, 2);
    }
  }
  if (model.charge) {
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(x + 2, y + s - 3, s - 4, 2);
    ctx.fillStyle = [PALETTE.textDim, PALETTE.cursor, PALETTE.eclipseGlow][model.charge.level] ?? PALETTE.eclipseGlow;
    ctx.fillRect(x + 2, y + s - 3, Math.round((s - 4) * model.charge.fill), 2);
  }
  if (model.state === 'busy') {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(nowMs / 110);
    ctx.strokeStyle = PALETTE.cursor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
    ctx.globalAlpha = 1;
  }
}

function moveSlots(ctx: Ctx, state: WorldState, screen: HudDims, view: CombatView, combat: number): void {
  const { player } = state;
  const ui = uiOf(view);
  const count = slotCount(player.loadout);
  const models: MoveSlotModel[] = [];
  PLAYER_SLOT_LAYOUT.forEach((_, index) => {
    if (index >= count) return;
    const model = moveSlotModel(player, index, view.device, view.pad);
    models.push(model);
    slotWindow(ctx, model, slotRect(screen, index, count), view.nowMs, ui);
  });
  // The names, only while idle: a short list above the block (hidden in a fight; the pause window lists them too).
  const alpha = 1 - combat;
  if (alpha <= 0.02) return;
  const before = dimBy(ctx, alpha);
  const first = slotRect(screen, 0, count);
  const rightEdge = slotRect(screen, count > 2 ? 1 : count - 1, count);
  models.forEach((model, i) => {
    if (model.state === 'empty') return;
    const text = model.key ? `${model.key.label}  ${model.name}` : model.name;
    outlined(ctx, text, rightEdge.x + rightEdge.width, first.y - 5 - (models.length - 1 - i) * 12, model.state === 'poor' ? PALETTE.danger : PALETTE.text, 11, 'right');
  });
  ctx.globalAlpha = before;
}

// -- Boss bar -----------------------------------------------------------------------------------------------------

/** One type badge: a diamond in the type's colours; with its initial when it is drawn at full size. */
function typeBadge(ctx: Ctx, type: keyof typeof TYPE_COLORS, x: number, y: number, size: number): void {
  const c = TYPE_COLORS[type];
  const f = size / 16;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(f, f);
  const cx = 8;
  const cy = 8;
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(16, cy);
  ctx.lineTo(cx, 16);
  ctx.lineTo(0, cy);
  ctx.closePath();
  ctx.fillStyle = PALETTE.ink;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, 1.5);
  ctx.lineTo(14.5, cy);
  ctx.lineTo(cx, 14.5);
  ctx.lineTo(1.5, cy);
  ctx.closePath();
  ctx.fillStyle = c.core;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = c.edge;
  ctx.stroke();
  ctx.restore();
  if (f >= 0.9) {
    const label = t(`type.${type}`).slice(0, 1).toUpperCase();
    ctx.font = canvasFont();
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText(label, x + cx + 1, y + cy + 4);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(label, x + cx, y + cy + 3);
  }
}

/**
 * The first living boss's bar, bottom centre: one line with the name in caps and the epithet after it, the type and
 * status icons, the card pips and clock at the right end; under it the thin gilt bar with chip trail and phase notches.
 */
function bossBlock(ctx: Ctx, state: WorldState, screen: HudDims, view: CombatView): void {
  const variant = hudVariant(screen);
  const ui = uiOf(view);
  const bar = bossBar(state);
  const hs = view.state;
  const arena = state.arena;
  // The boss the bar showed last frame is gone from it: felled (dead on this floor), or the floor changed under the bar.
  const lastDied = hs.last !== null && (!bar || hs.last.id !== bar.enemyId) && state.enemies.some((e) => e.id === hs.last!.id && !e.alive && !e.spent);
  const stage = hs.stage.update({ id: bar?.enemyId ?? null, species: bar?.species ?? null, alive: bar !== null, sameFloor: hs.last === null || hs.last.arena === arena, lastDied }, view.nowMs);
  if (stage.defeat) defeatBanner(ctx, stage.defeat, screen, variant, view.nowMs);
  if (!bar) {
    hs.last = null;
    hs.boss = createChipTrail(1);
    return;
  }
  if (!hs.last || hs.last.id !== bar.enemyId) hs.boss = createChipTrail(1);
  hs.last = { id: bar.enemyId, species: bar.species, arena };

  const enemy: EnemyState | undefined = state.enemies.find((e) => e.id === bar.enemyId);
  const box = bossRect(screen, slotCount(state.player.loadout), view.touch);
  const herald = heraldBarText(state, bar.enemyId);
  const model = bossBarModel({
    bar,
    enemy,
    chip: 1,
    name: bar.species === 'eclipse-echo' ? echoName(state.echoMimic) : t(`species.${view.shownAs?.get(bar.enemyId) ?? bar.species}`),
    ...(herald ? { tag: herald.label } : {}),
    capture: state.capture,
  });
  const shownFill = model.fill * stage.fill;
  const chip = Math.max(shownFill, hs.boss.update(model.fill, view.nowMs) * stage.fill);
  const { x, y, width: w } = box;
  const bx = x + 4;
  const bw = w - 8;
  const nameBase = y + 11;

  // Name and epithet fade in first; the frame follows.
  ctx.globalAlpha = stage.enter;
  // The right end of the line, from the edge in: statuses, type, clock, card pips.
  let rx = x + w - 2;
  const iconY = y + 6 - ui.s / 2;
  for (const status of [...model.statuses].reverse()) {
    rx -= ui.s + 2;
    smallIcon(ctx, STATUS_ICON[status], rx, iconY, ui);
  }
  if (model.type) {
    rx -= ui.s + 3;
    typeBadge(ctx, model.type, snap(rx, ui.scale), snap(iconY, ui.scale), ui.s);
  }
  if (model.pips) {
    rx -= 4;
    for (let i = model.pips.length - 1; i >= 0; i--) {
      rx -= 7;
      const pip = model.pips[i]!;
      diamond(ctx, rx + 3, y + 6, 2, pip === 'done' ? PALETTE.disabled : pip === 'live' ? PALETTE.cursor : null, PALETTE.textDim);
    }
  }
  const room = rx - bx - 6;
  const nameW = spaced(ctx, model.name.toUpperCase(), bx, nameBase, PALETTE.text, 12, 2, 'left');
  // A thin ornament (hairline with a lit diamond), then the epithet dimmer, and the stance in play: only what fits.
  const epithet = model.tag ? `${model.epithet} · ${model.tag}` : model.epithet;
  const afterName = bx + nameW + 6;
  if (room - nameW > 70) {
    ctx.fillStyle = PALETTE.borderShade;
    ctx.fillRect(Math.round(afterName), nameBase - 4, 8, 1);
    diamond(ctx, Math.round(afterName) + 11, nameBase - 3.5, 1.5, GOLD, GOLD);
    fitted(ctx, epithet, afterName + 16, nameBase, room - nameW - 22, herald ? herald.colour : PALETTE.textDim);
  }

  // The card clock: its own plate centred over the bar, with the result of the last card and the first-time tip above it.
  ctx.globalAlpha = stage.enter;
  const clockRect = cardClockRect(box, view.touch);
  const plateTop = model.clock ? cardClockPlate(ctx, model.clock, box, clockRect, view.touch, ui) : box.y - CARD_CLOCK.gap;
  ctx.globalAlpha = 1;
  if (view.cardResult) cardResultBand(ctx, view.cardResult, box, clockRect, view.touch, plateTop, view.nowMs);
  if (view.cardTip) cardTipPanel(ctx, view.cardTip.shownAtMs, cardTipRect(screen, view.touch), view.nowMs);

  // The bar: an iron frame with gilt finials, a darker blood fill, the chip trail in ember.
  ctx.globalAlpha = Math.min(1, stage.enter * 2);
  const colour = herald ? herald.colour : model.guarded ? '#8fb3ff' : RELIC.blood;
  const by = y + 15;
  ironBar(ctx, bx, by, bw, BOSS_BAR.thick, shownFill, chip, colour);
  // Phase notches: a tick where each card's segment ends (passed ones dim, the next one pulses in "tu turno").
  for (const notch of model.notches) {
    const nx = Math.round(bx + bw * notch.at);
    ctx.globalAlpha = notch.passed ? 0.35 : 1;
    ctx.fillStyle = notch.live ? PALETTE.cursor : PALETTE.text;
    ctx.fillRect(nx, by - 1, 1, BOSS_BAR.thick + 2);
  }
  ctx.globalAlpha = 1;
}

// -- Card clock (odd/tasks/last-phase-and-timer.md S3, docs/research/boss-timer.md) ------------------------------

/** Plate sizes in HUD px: digits calm and at the urgent pulse's peak, the hourglass's art scale, the draining line. */
const CLOCK_PLATE = { digits: 20, gap: 6, line: 3, pad: 4 } as const; // 20 + 3 + 3 x 4 = ui/hud-layout.ts CARD_CLOCK.plateHeight

/**
 * The card's clock over the boss bar, centred: a large hourglass (upside down in the last 5 s), the seconds in big
 * digits (red, larger and pulsing in the last 5 s: size and the flipped glass carry the warning without colour), the
 * capture seal with its word (a lit gem while the capture is still on; hollow and struck through once a hit lost
 * it), and a line that drains with the card's time. Returns the plate's top edge.
 */
function cardClockPlate(ctx: Ctx, clock: CardClockView, box: HudBox, rect: HudBox, touch: boolean, ui: Ui): number {
  const size = Math.round(CLOCK_PLATE.digits * clock.scale);
  const digits = String(clock.seconds);
  const glass = ui.s * 1.5;
  const sealWord = clock.seal === 'lost' ? t('card.clock.sealLost') : t('card.clock.seal');
  const digitW = widthOf(ctx, digits, size);
  const sealW = clock.seal ? 12 + CLOCK_PLATE.gap + widthOf(ctx, sealWord, 10) : 0;
  const inner = glass + CLOCK_PLATE.gap + Math.max(digitW, widthOf(ctx, '00', CLOCK_PLATE.digits)) + (sealW > 0 ? CLOCK_PLATE.gap * 2 + sealW : 0);
  const w = Math.round(inner + CLOCK_PLATE.pad * 4);
  const h = CLOCK_PLATE.digits + CLOCK_PLATE.line + CLOCK_PLATE.pad * 3;
  // Centred over the bar; on touch at its left end (core of ui/hud-layout.ts `cardClockRect`).
  const x = Math.round(touch ? rect.x : rect.x + rect.width / 2 - w / 2);
  const y = Math.round(box.y - h - CARD_CLOCK.gap);
  // A dark plate with a gilt hairline (red once urgent, and thicker: a shape cue too).
  ctx.fillStyle = 'rgba(5,4,7,0.78)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = clock.urgent ? PALETTE.danger : PALETTE.borderShade;
  const edge = clock.urgent ? 2 : 1;
  ctx.fillRect(x, y, w, edge);
  ctx.fillRect(x, y + h - edge, w, edge);
  ctx.fillRect(x, y, edge, h);
  ctx.fillRect(x + w - edge, y, edge, h);
  // The hourglass, flipped in the last seconds.
  const gx = x + CLOCK_PLATE.pad * 2;
  const gy = y + CLOCK_PLATE.pad + (CLOCK_PLATE.digits - glass) / 2;
  ctx.save();
  if (clock.urgent) {
    ctx.translate(gx + glass / 2, gy + glass / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-(gx + glass / 2), -(gy + glass / 2));
  }
  drawIcon(ctx, COMBAT_ICONS.hourglass!, snap(gx, ui.scale), snap(gy, ui.scale), ui.u * 1.5, 1);
  ctx.restore();
  // The seconds: big, centred on their own column.
  const dx = gx + glass + CLOCK_PLATE.gap;
  const columnW = Math.max(digitW, widthOf(ctx, '00', CLOCK_PLATE.digits));
  outlined(ctx, digits, dx + columnW / 2, y + CLOCK_PLATE.pad + CLOCK_PLATE.digits - 2 + (size - CLOCK_PLATE.digits) / 3, clock.urgent ? PALETTE.danger : PALETTE.text, size, 'center');
  // The capture seal: a gem lit gold, or hollow and struck through, and its word.
  if (clock.seal) {
    const sx = dx + columnW + CLOCK_PLATE.gap * 2;
    const sy = y + CLOCK_PLATE.pad + CLOCK_PLATE.digits / 2;
    const live = clock.seal === 'live';
    diamond(ctx, sx + 5, sy - 1, 5, live ? PALETTE.cursor : null, live ? PALETTE.text : PALETTE.disabled);
    if (!live) {
      ctx.fillStyle = PALETTE.disabled;
      ctx.fillRect(Math.round(sx - 1), Math.round(sy - 1), 13, 1);
    }
    outlined(ctx, sealWord, sx + 12 + CLOCK_PLATE.gap, sy + 3, live ? PALETTE.cursor : PALETTE.disabled, 10, 'left');
  }
  // The line that drains with the card's time, right to left.
  const lx = x + CLOCK_PLATE.pad;
  const lw = w - CLOCK_PLATE.pad * 2;
  const ly = y + h - CLOCK_PLATE.pad - CLOCK_PLATE.line;
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(lx, ly, lw, CLOCK_PLATE.line);
  ctx.fillStyle = clock.urgent ? PALETTE.danger : GOLD;
  ctx.fillRect(lx, ly, Math.round(lw * clock.share), CLOCK_PLATE.line);
  return y;
}

/** "¡CARTA SUPERADA!" / "¡TIEMPO!" over the clock plate as a card ends, with what it means under it. Returns its top edge. */
function cardResultBand(ctx: Ctx, banner: CardResultBanner, box: HudBox, rect: HudBox, touch: boolean, bottom: number, nowMs: number): number {
  const a = resultAlpha(nowMs - banner.shownAtMs);
  if (a <= 0) return bottom;
  // Over the clock's plate: centred on the bar, on touch over the bar's left end (clear of the thumb buttons).
  ctx.font = canvasFont(16);
  const cx = touch ? rect.x + Math.max(rect.width, widthOf(ctx, banner.heading, 16) + 30) / 2 : box.x + box.width / 2;
  const h = banner.sub ? 34 : 22;
  const y = bottom - h - 2;
  const before = ctx.globalAlpha;
  ctx.globalAlpha = a;
  const bx = touch ? rect.x : box.x;
  const bw = touch ? 2 * (cx - rect.x) : box.width;
  const band = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  band.addColorStop(0, 'rgba(5,4,7,0)');
  band.addColorStop(0.2, 'rgba(5,4,7,0.75)');
  band.addColorStop(0.8, 'rgba(5,4,7,0.75)');
  band.addColorStop(1, 'rgba(5,4,7,0)');
  ctx.fillStyle = band;
  ctx.fillRect(bx, y, bw, h);
  const colour = banner.tone === 'good' ? PALETTE.cursor : PALETTE.danger;
  spaced(ctx, banner.heading, cx, y + 17, colour, 16, 2, 'center');
  if (banner.sub) outlined(ctx, banner.sub, cx, y + 30, PALETTE.text, 10, 'center');
  ctx.globalAlpha = before;
  return y;
}

/** Words of `text` in lines no wider than `maxW` at `size`. */
function wrapped(ctx: Ctx, text: string, maxW: number, size: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && widthOf(ctx, next, size) > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** The one-time tip on the card clock: a framed panel under the boss announcement (ui/hud-layout.ts `cardTipRect`), its title in gold, then the rule in a few lines. */
function cardTipPanel(ctx: Ctx, shownAtMs: number, rect: HudBox, nowMs: number): void {
  const age = nowMs - shownAtMs;
  if (age < 0 || age >= TIP_MS) return;
  const a = Math.min(1, age / 250, (TIP_MS - age) / 500);
  const tip = cardTipText();
  const w = rect.width;
  const lines = wrapped(ctx, tip.body, w - 16, 10);
  const h = 22 + lines.length * 12;
  const x = rect.x;
  const y = rect.y;
  const before = ctx.globalAlpha;
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(5,4,7,0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  diamond(ctx, x + 10, y + 9, 3, PALETTE.cursor, PALETTE.text);
  outlined(ctx, tip.title, x + 18, y + 13, PALETTE.cursor, 11, 'left');
  lines.forEach((line, i) => outlined(ctx, line, x + 8, y + 26 + i * 12, PALETTE.text, 10, 'left'));
  ctx.globalAlpha = before;
}

/** "GUARDIÁN CAÍDO": a slim dark band in the lower fifth (clear of the arena's middle), the name carved in gold, fading in and out. */
function defeatBanner(ctx: Ctx, defeat: NonNullable<ReturnType<BossStage['update']>['defeat']>, screen: HudSize, variant: HudVariant, nowMs: number): void {
  void nowMs;
  void variant;
  const a = defeat.alpha;
  const cy = Math.round(screen.height * 0.8);
  const h = 42;
  const band = ctx.createLinearGradient(0, 0, screen.width, 0);
  band.addColorStop(0, 'rgba(5,4,7,0)');
  band.addColorStop(0.2, 'rgba(5,4,7,0.7)');
  band.addColorStop(0.8, 'rgba(5,4,7,0.7)');
  band.addColorStop(1, 'rgba(5,4,7,0)');
  ctx.globalAlpha = a;
  ctx.fillStyle = band;
  ctx.fillRect(0, cy - h / 2, screen.width, h);
  ctx.fillStyle = GOLD;
  const rule = Math.round(Math.min(screen.width * 0.4, 240) * Math.min(1, a * 1.4));
  ctx.fillRect(Math.round(screen.width / 2 - rule / 2), cy - h / 2 + 2, rule, 1);
  ctx.fillRect(Math.round(screen.width / 2 - rule / 2), cy + h / 2 - 3, rule, 1);
  spaced(ctx, t('boss.felled'), screen.width / 2, cy + 3, PALETTE.cursor, 22, 3, 'center');
  outlined(ctx, t(`species.${defeat.species}`), screen.width / 2, cy + h / 2 - 7, PALETTE.textDim, 11, 'center');
  ctx.globalAlpha = 1;
}

// -- Boss event announcement --------------------------------------------------------------------------------------

const prefersReducedMotion = (): boolean => {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** An ornamental bracket for the announcement: a gilt rule with serifs at both ends and a lit diamond in the middle, `dir` 1 opens to the right. */
function bracket(ctx: Ctx, x: number, y: number, h: number, dir: 1 | -1): void {
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x - 1, y - 1, 3, h + 2);
  ctx.fillRect(dir > 0 ? x - 1 : x - 7, y - 1, 8, 3);
  ctx.fillRect(dir > 0 ? x - 1 : x - 7, y + h - 2, 8, 3);
  ctx.fillStyle = GOLD;
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(dir > 0 ? x : x - 6, y, 7, 1);
  ctx.fillRect(dir > 0 ? x : x - 6, y + h - 1, 7, 1);
  ctx.fillStyle = PALETTE.borderShade;
  ctx.fillRect(x + dir * 2, y + 3, 1, h - 6);
  diamond(ctx, x + dir * 5, y + h / 2, 2, PALETTE.cursor, GOLD);
}

/**
 * A boss event announced at the top centre, on the line a quarter down the screen (never over the arena's middle; the telegraph
 * on the floor is the information): the move's name (~28 CSS px, ember-red with an ink outline) between two gilt brackets with
 * a drawn rule under it, then one line, the sign with its seal icon and the telegraph cue with its icon. Enters in 160 ms, holds
 * 2.6 s, leaves in 240 ms; under reduced motion it only fades.
 */
export function drawBossCaption(ctx: Ctx, spell: SpellBanner, nowMs: number, screen: HudDims, view: Pick<CombatView, 'scale' | 'touch'>, slots = 4): void {
  const age = nowMs - spell.shownAtMs;
  if (age < 0 || age >= CAPTION_LIFE_MS) return;
  const reduced = prefersReducedMotion();
  const motion = captionMotion(age, reduced);
  if (motion.alpha <= 0) return;
  const ui = uiOf(view);
  const caption = (spell.stance ? bossCaption(spell.stance, spell.species ?? null, spell.heraldName) : null) ?? { name: spell.name, sign: spell.title ? spell.title : t('boss.sign.omen'), cue: 'area' as const };
  const box = captionRect(screen, view.touch ? 0 : slots, view.touch);
  const cx = box.x + box.width / 2;
  const size = captionNameSize(view.scale, view.touch);
  const nameBase = box.y + size + 2;
  const inner = box.width - 28;

  ctx.save();
  ctx.globalAlpha = motion.alpha;
  // A dark band behind, fading to the sides: the arena stays visible around it.
  const band = ctx.createLinearGradient(box.x - 20, 0, box.x + box.width + 20, 0);
  band.addColorStop(0, 'rgba(5,4,7,0)');
  band.addColorStop(0.12, 'rgba(5,4,7,0.72)');
  band.addColorStop(0.88, 'rgba(5,4,7,0.72)');
  band.addColorStop(1, 'rgba(5,4,7,0)');
  ctx.fillStyle = band;
  ctx.fillRect(box.x - 20, box.y, box.width + 40, box.height);
  bracket(ctx, box.x + 8, box.y + 2, box.height - 4, 1);
  bracket(ctx, box.x + box.width - 8, box.y + 2, box.height - 4, -1);
  // The name settles from a little larger, like a seal pressed down.
  ctx.save();
  ctx.translate(cx, nameBase);
  const grow = 1 + 0.08 * motion.settle;
  ctx.scale(grow, grow);
  ctx.translate(-cx, -nameBase);
  const upper = caption.name.toUpperCase();
  const natural = widthOf(ctx, upper, size) + 2 * Math.max(0, upper.length - 1);
  if (natural <= inner) spaced(ctx, upper, cx, nameBase, PALETTE.eclipseGlow, size, 2, 'center');
  else fitted(ctx, upper, box.x + 14, nameBase, inner, PALETTE.eclipseGlow, 'center', size);
  ctx.restore();
  // The rule draws out from the middle, a lit diamond at its centre.
  const rule = Math.round(inner * motion.rule);
  const ruleY = nameBase + 4;
  ctx.fillStyle = GOLD;
  ctx.fillRect(Math.round(cx - rule / 2), ruleY, rule, 1);
  if (motion.rule >= 1) diamond(ctx, cx, ruleY + 0.5, 2, PALETTE.eclipseGlow, GOLD);
  // One line: the sign (seal icon) and the telegraph cue (its icon and how to read it).
  const cue = BOSS_CUES.includes(caption.cue) ? caption.cue : 'area';
  const sign = caption.sign.toUpperCase();
  const hint = t(`boss.cue.${cue}`);
  const signW = widthOf(ctx, sign) + ui.s + 3;
  const hintW = widthOf(ctx, hint) + ui.s + 3;
  const gap = 12;
  const squeeze = Math.min(1, inner / (signW + gap + hintW));
  const lineBase = box.y + box.height - 4;
  const left = cx - ((signW + gap + hintW) * squeeze) / 2;
  ctx.save();
  ctx.translate(left, 0);
  ctx.scale(squeeze, 1);
  smallIcon(ctx, 'seal', 0, lineBase - 4 - ui.s / 2, ui);
  outlined(ctx, sign, ui.s + 3, lineBase, PALETTE.cursor, 11, 'left');
  smallIcon(ctx, `cue-${cue}`, signW + gap, lineBase - 4 - ui.s / 2, ui);
  outlined(ctx, hint, signW + gap + ui.s + 3, lineBase, PALETTE.text, 11, 'left');
  ctx.restore();
  ctx.restore();
}

// -- Entry --------------------------------------------------------------------------------------------------------

/** The combat HUD's panels for one frame (the flash toast, gate notices and the rest stay with `drawFlashToast` and the renderer). */
export function drawCombatPanels(ctx: Ctx, state: WorldState, screen: HudDims, view: CombatView): void {
  const combat = view.state.fade.update(fightKind(state) !== 'calm', view.nowMs);
  view.state.combat = combat;
  statusWindow(ctx, state, screen, view, combat);
  partnerFrames(ctx, state, screen, view);
  // Touch: the slot buttons show the moves (src/adapters/touch-slots.ts); no slot windows under the thumbs.
  if (!view.touch) moveSlots(ctx, state, screen, view, combat);
  bossBlock(ctx, state, screen, view);
}
