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
import { STAMINA_MAX, bossBarModel, createBossStage, createChipTrail, createCombatFade, createPassiveNote, fightKind, fillOf, moveSlotModel, type BossStage, type BossStatus, type ChipTrail, type CombatFade, type MoveSlotModel, type PassiveNote } from '../ui/combat-hud-model';
import { COMBAT_ICONS, drawIcon } from '../ui/combat-icons';
import { drawPanel, noLigatures } from '../ui/canvas';
import { BOSS_BAR, HUD_METRICS, bossRect, captionRect, chipsRect, hudVariant, slotRect, statusRect, type HudBox, type HudDims, type HudVariant } from '../ui/hud-layout';
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

/** A small slot: the move's icon, its key glyph and the cooldown sweep; ranks as tiny pips. Names show elsewhere (idle list, pause). */
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
  smallIcon(ctx, SLOT_ICON[model.index] ?? 'slotFast', x + (s - ui.s) / 2, y + (s - ui.s) / 2 - 1, ui, dim ? 0.5 : 1);
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
  if (model.key) keycap(ctx, model.key.label, x + 2, y + s - 12, model.key.kind, dim, 10);
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
  });
  const shownFill = model.fill * stage.fill;
  const chip = Math.max(shownFill, hs.boss.update(model.fill, view.nowMs) * stage.fill);
  const { x, y, width: w } = box;
  const bx = x + 4;
  const bw = w - 8;
  const nameBase = y + 12;

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
  if (model.clock) {
    const label = t('hud.cooldown').replace('{s}', String(model.clock.seconds));
    rx -= 4;
    outlined(ctx, label, rx, nameBase, model.clock.urgent ? PALETTE.danger : PALETTE.textDim, 11, 'right');
    rx -= widthOf(ctx, label) + ui.s + 2;
    smallIcon(ctx, 'hourglass', rx, iconY, ui, model.clock.urgent ? 1 : 0.7);
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
  const nameW = spaced(ctx, model.name.toUpperCase(), bx, nameBase, PALETTE.text, 12, 1, 'left');
  // Epithet (the lore line), the stance in play after it: only what fits on the line.
  const epithet = model.tag ? `${model.epithet} · ${model.tag}` : model.epithet;
  if (room - nameW > 70) fitted(ctx, epithet, bx + nameW + 8, nameBase, room - nameW - 8, herald ? herald.colour : PALETTE.textDim);

  // The thin gilt bar.
  ctx.globalAlpha = Math.min(1, stage.enter * 2);
  const colour = herald ? herald.colour : model.guarded ? '#8fb3ff' : PALETTE.eclipse;
  const by = y + 19;
  relicBar(ctx, bx, by, bw, BOSS_BAR.thick, shownFill, chip, colour);
  for (const ex of [bx - 5, bx + bw + 5]) diamond(ctx, ex, by + BOSS_BAR.thick / 2, 2, GOLD, GOLD);
  // Phase notches: a tick where each card's segment ends (passed ones dim, the next one pulses in "tu turno").
  for (const notch of model.notches) {
    const nx = Math.round(bx + bw * notch.at);
    ctx.globalAlpha = notch.passed ? 0.35 : 1;
    ctx.fillStyle = notch.live ? PALETTE.cursor : PALETTE.text;
    ctx.fillRect(nx, by - 2, 1, BOSS_BAR.thick + 4);
  }
  ctx.globalAlpha = 1;
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

/**
 * A boss event announced in a compact strip right above the boss bar, never over the arena (the telegraph on the floor is
 * the information): the move's name (~22 CSS px) with a drawn rule under it, then one small line, the sign and the
 * telegraph cue with its icon. Enters in 160 ms, holds 1.4 s, leaves in 240 ms; under reduced motion it only fades.
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
  const size = view.touch ? 14 : Math.round(22 / view.scale);
  const nameBase = box.y + size;

  ctx.save();
  ctx.globalAlpha = motion.alpha;
  // A dark band behind, fading to the sides: the arena stays visible above it.
  const band = ctx.createLinearGradient(box.x - 20, 0, box.x + box.width + 20, 0);
  band.addColorStop(0, 'rgba(5,4,7,0)');
  band.addColorStop(0.15, 'rgba(5,4,7,0.6)');
  band.addColorStop(0.85, 'rgba(5,4,7,0.6)');
  band.addColorStop(1, 'rgba(5,4,7,0)');
  ctx.fillStyle = band;
  ctx.fillRect(box.x - 20, box.y, box.width + 40, box.height);
  // The name settles from a little larger, like a seal pressed down.
  ctx.save();
  ctx.translate(cx, nameBase);
  const grow = 1 + 0.08 * motion.settle;
  ctx.scale(grow, grow);
  ctx.translate(-cx, -nameBase);
  const upper = caption.name.toUpperCase();
  const natural = widthOf(ctx, upper, size) + 2 * Math.max(0, upper.length - 1);
  if (natural <= box.width - 8) spaced(ctx, upper, cx, nameBase, PALETTE.eclipseGlow, size, 2, 'center');
  else fitted(ctx, upper, box.x + 4, nameBase, box.width - 8, PALETTE.eclipseGlow, 'center', size);
  ctx.restore();
  // The rule draws out from the middle.
  const rule = Math.round((box.width - 8) * motion.rule);
  ctx.fillStyle = GOLD;
  ctx.fillRect(Math.round(cx - rule / 2), nameBase + 4, rule, 1);
  // One small line: the sign (seal icon) and the telegraph cue (its icon and how to read it).
  const cue = BOSS_CUES.includes(caption.cue) ? caption.cue : 'area';
  const sign = caption.sign.toUpperCase();
  const hint = t(`boss.cue.${cue}`);
  const signW = widthOf(ctx, sign) + ui.s + 3;
  const hintW = widthOf(ctx, hint) + ui.s + 3;
  const gap = 10;
  const squeeze = Math.min(1, (box.width - 8) / (signW + gap + hintW));
  const lineBase = box.y + box.height - 3;
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

/** The combat HUD's panels for one frame (the flashes, gate notices and the rest stay with `drawHud`). */
export function drawCombatPanels(ctx: Ctx, state: WorldState, screen: HudDims, view: CombatView): void {
  const combat = view.state.fade.update(fightKind(state) !== 'calm', view.nowMs);
  view.state.combat = combat;
  statusWindow(ctx, state, screen, view, combat);
  partnerFrames(ctx, state, screen, view);
  // Touch: the slot buttons show the moves (src/adapters/touch-slots.ts); no slot windows under the thumbs.
  if (!view.touch) moveSlots(ctx, state, screen, view, combat);
  bossBlock(ctx, state, screen, view);
}
