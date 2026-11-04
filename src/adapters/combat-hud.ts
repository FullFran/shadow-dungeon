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
import { STAMINA_MAX, bossBarModel, createBossStage, createChipTrail, fillOf, moveSlotModel, type BossStage, type BossStatus, type ChipTrail, type MoveSlotModel } from '../ui/combat-hud-model';
import { COMBAT_ICONS, drawIcon } from '../ui/combat-icons';
import { drawPanel, noLigatures } from '../ui/canvas';
import { HUD_METRICS, bossRect, hudVariant, slotRect, statusRect, type HudBox, type HudVariant } from '../ui/hud-layout';
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
}

export const createCombatHudState = (): CombatHudState => ({ hp: null, boss: createChipTrail(1), stage: createBossStage(), partners: new Map(), last: null });

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
function keycap(ctx: Ctx, label: string, x: number, y: number, kind: 'key' | 'pad', dim: boolean): void {
  const w = Math.max(13, Math.ceil(widthOf(ctx, label)) + 6);
  const h = 12;
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
  ctx.fillText(noLigatures(label), Math.round(x + w / 2), y + 10);
}

const STATUS_ICON: Record<BossStatus, string> = { stun: 'stun', poison: 'poison', burn: 'flame', mark: 'mark', weak: 'weak', guard: 'shield', held: 'seal' };

// -- Status window -----------------------------------------------------------------------------------------------

interface StatusOffsets {
  pad: number;
  hpBarY: number;
  hpBarH: number;
  stIcon: number;
  stBarY: number;
  stBarH: number;
  xpY: number;
  xpH: number;
  pasIcon: number;
  pasBase: number;
  footIcon: number;
  footBase: number;
  badgeY: number;
  badgeH: number;
}

const OFFSETS: Record<HudVariant, StatusOffsets> = {
  regular: { pad: 6, hpBarY: 8, hpBarH: 11, stIcon: 22, stBarY: 28, stBarH: 5, xpY: 36, xpH: 3, pasIcon: 42, pasBase: 54, footIcon: 64, footBase: 76, badgeY: 52, badgeH: 12 },
  compact: { pad: 5, hpBarY: 6, hpBarH: 10, stIcon: 17, stBarY: 22, stBarH: 4, xpY: 29, xpH: 2, pasIcon: 32, pasBase: 43, footIcon: 53, footBase: 65, badgeY: 43, badgeH: 11 },
};

/** The top-left window: portrait with the level, HP with its chip trail, stamina, XP, the passive, the floor and the coins. */
function statusWindow(ctx: Ctx, state: WorldState, screen: HudSize, view: CombatView): void {
  const { player } = state;
  const variant = hudVariant(screen);
  const m = HUD_METRICS[variant];
  const o = OFFSETS[variant];
  const chip = itemsChip(player.items.length, view.touch);
  const { x, y, width, height } = statusRect(screen, chip !== null, view.touch);
  drawPanel(ctx, x, y, width, height, { alpha: 0.92 });
  studs(ctx, x, y, width, height);

  // Portrait: a sprite-fit box, the creature whole and standing on its floor; the level badge under it.
  const box: HudBox = { x: x + o.pad, y: y + o.pad, width: m.portrait, height: m.portrait };
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(box.x - 1, box.y - 1, box.width + 2, box.height + 2);
  const sky = ctx.createLinearGradient(0, box.y, 0, box.y + box.height);
  sky.addColorStop(0, RELIC.slabEdge);
  sky.addColorStop(1, PALETTE.windowBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  view.portrait?.(ctx, player, { x: box.x + 2, y: box.y + 2, width: box.width - 4, height: box.height - 4 }, view.nowMs);
  ctx.fillStyle = PALETTE.borderShade;
  ctx.fillRect(box.x, box.y + box.height - 1, box.width, 1);
  const badge = { x: box.x, y: y + o.badgeY, w: box.width, h: o.badgeH };
  drawPanel(ctx, badge.x, badge.y, badge.w, badge.h, { alpha: 1, border: PALETTE.cursor });
  ctx.font = canvasFont();
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.cursor;
  ctx.fillText(t('hud.status.level').replace('{n}', String(player.level)), Math.round(badge.x + badge.w / 2), badge.y + o.badgeH - 3);

  const x0 = box.x + box.width + o.pad;
  const innerW = x + width - o.pad - x0;
  const barX = x0 + 20;
  const barW = innerW - 20;

  // HP: the heart, the bar with its chip trail, the numbers on it.
  const hpFill = fillOf(player.hp, player.maxHp);
  view.state.hp ??= createChipTrail(hpFill);
  const hpChip = view.state.hp.update(hpFill, view.nowMs);
  drawIcon(ctx, COMBAT_ICONS.heart!, x0, y + o.hpBarY + Math.round(o.hpBarH / 2) - 8, 1);
  relicBar(ctx, barX, y + o.hpBarY, barW, o.hpBarH, hpFill, hpChip, PALETTE.hp, PALETTE.hpLow);
  outlined(ctx, `${Math.ceil(Math.max(0, player.hp))}/${Math.ceil(player.maxHp)}`, barX + barW / 2, y + o.hpBarY + o.hpBarH - 2, PALETTE.text, 11, 'center');

  // Stamina (the bolt) and experience (the thin line under it).
  drawIcon(ctx, COMBAT_ICONS.bolt!, x0, y + o.stIcon, 1);
  relicBar(ctx, barX, y + o.stBarY, barW, o.stBarH, fillOf(player.stamina, STAMINA_MAX), 0, PALETTE.stamina);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(barX - 1, y + o.xpY - 1, barW + 2, o.xpH + 2);
  ctx.fillStyle = PALETTE.barBack;
  ctx.fillRect(barX, y + o.xpY, barW, o.xpH);
  ctx.fillStyle = PALETTE.xp;
  ctx.fillRect(barX, y + o.xpY, Math.round(barW * levelProgress(player.xp).fill), o.xpH);

  // The passive: the mask, bright while ready, with its state in words.
  const passive = passiveStatus(player);
  drawIcon(ctx, COMBAT_ICONS.mask!, x0, y + o.pasIcon, 1, passive.ready ? 1 : 0.45);
  fitted(ctx, passive.text, barX, y + o.pasBase, barW, passive.ready ? PALETTE.cursor : PALETTE.disabled);

  // The foot: the stairs and the floor, the coin and the run's coins.
  drawIcon(ctx, COMBAT_ICONS.stairs!, box.x, y + o.footIcon, 1);
  outlined(ctx, t('hud.status.floor').replace('{n}', String(view.floor)), box.x + 20, y + o.footBase, PALETTE.text);
  if (view.coins !== undefined) {
    const label = coinsLabel(view.coins);
    const w = widthOf(ctx, label);
    outlined(ctx, label, x + width - o.pad, y + o.footBase, PALETTE.cursor, 11, 'right');
    drawIcon(ctx, COMBAT_ICONS.coin!, x + width - o.pad - w - 19, y + o.footIcon, 1);
  }
  if (chip) outlined(ctx, chip, box.x, y + height - 5, PALETTE.textDim);
}

// -- Co-op frames -------------------------------------------------------------------------------------------------

/** Each partner under the status window: portrait, name, HP; a downed one is dim with a skull. */
function partnerFrames(ctx: Ctx, state: WorldState, screen: HudSize, view: CombatView): void {
  const variant = hudVariant(screen);
  const m = HUD_METRICS[variant];
  const status = statusRect(screen, itemsChip(state.player.items.length, view.touch) !== null, view.touch);
  state.remotes.forEach((remote, i) => {
    const w = m.partnerWidth;
    const h = m.partnerHeight;
    const x = status.x;
    const y = status.y + status.height + m.partnerGap + i * (h + m.partnerGap);
    const down = remote.player.hp <= 0;
    drawPanel(ctx, x, y, w, h, { alpha: 0.9, border: down ? PALETTE.borderShade : GOLD });
    const pbox: HudBox = { x: x + 3, y: y + 3, width: h - 6, height: h - 6 };
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(pbox.x - 1, pbox.y - 1, pbox.width + 2, pbox.height + 2);
    view.portrait?.(ctx, remote.player, pbox, view.nowMs, down);
    const name = view.names?.get(remote.id) ?? t(`species.${remote.player.species}`);
    const tx = x + h + 2;
    if (down) {
      // Downed: the name dim on one row, the skull and "Caído" at the right.
      const label = t('hud.partner.down');
      const lw = widthOf(ctx, label);
      drawIcon(ctx, COMBAT_ICONS.skull!, x + w - 19, y + 3, 1, 0.85);
      outlined(ctx, label, x + w - 21, y + 15, PALETTE.disabled, 11, 'right');
      fitted(ctx, name, tx, y + 15, w - h - 6 - lw - 22, PALETTE.disabled);
      return;
    }
    fitted(ctx, name, tx, y + 11, w - h - 6, PALETTE.text);
    let trail = view.state.partners.get(remote.id);
    const fill = fillOf(remote.player.hp, remote.player.maxHp);
    if (!trail) {
      trail = createChipTrail(fill);
      view.state.partners.set(remote.id, trail);
    }
    const chip = trail.update(fill, view.nowMs);
    const bw = w - h - 8;
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(tx - 1, y + h - 8, bw + 2, 6);
    ctx.fillStyle = PALETTE.barBack;
    ctx.fillRect(tx, y + h - 7, bw, 4);
    ctx.fillStyle = CHIP_COLOUR;
    ctx.fillRect(tx, y + h - 7, Math.round(bw * chip), 4);
    ctx.fillStyle = fill <= 0.3 ? PALETTE.hpLow : PALETTE.hp;
    ctx.fillRect(tx, y + h - 7, Math.round(bw * fill), 4);
  });
}

// -- Move slots ---------------------------------------------------------------------------------------------------

const SLOT_ICON = ['slotFast', 'slotHeavy', 'slotBoost', 'slotArea'] as const;

function slotWindow(ctx: Ctx, model: MoveSlotModel, box: HudBox, nowMs: number): void {
  const { x, y, width: s } = box;
  const empty = model.state === 'empty';
  const colours = model.type ? TYPE_COLORS[model.type] : null;
  const border = model.state === 'busy' ? PALETTE.cursor : model.glowing && colours ? colours.core : model.state === 'poor' ? PALETTE.danger : empty ? PALETTE.borderShade : GOLD;
  const alpha = empty ? 0.55 : 0.92;
  drawPanel(ctx, x, y, s, s, { alpha, border });
  studs(ctx, x, y, s, s, border);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 2, y + 2, s - 4, s - 4);
  ctx.clip();
  if (colours) {
    // The move's type: a band along the top and a faint wash of its colour behind the icon.
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = colours.core;
    ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colours.core;
    ctx.fillRect(x + 2, y + 2, s - 4, 3);
    ctx.fillStyle = colours.edge;
    ctx.fillRect(x + 2, y + 5, s - 4, 1);
  }
  const dim = model.state === 'cooling' || empty;
  drawIcon(ctx, COMBAT_ICONS[SLOT_ICON[model.index] ?? 'slotFast']!, x + Math.round((s - 16) / 2), y + 9, 1, dim ? 0.5 : 1);
  if (model.state === 'poor') {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = PALETTE.hpLow;
    ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
    ctx.globalAlpha = 1;
  }
  if (model.cooldown) {
    // The sweep: the share still to run stays dark, clockwise from the top, and the seconds on it.
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
  if (model.cooldown) outlined(ctx, String(model.cooldown.seconds), x + s / 2, y + 28, PALETTE.cursor, 22, 'center');
  if (empty) {
    outlined(ctx, '·', x + s / 2, y + s - 6, PALETTE.disabled, 11, 'center');
    return;
  }
  if (model.key) keycap(ctx, model.key.label, x + 4, y + 8, model.key.kind, dim);
  // Mejoras: the rank diamonds in the move's tier colour.
  if (model.rank) {
    const step = 8;
    const left = x + s / 2 - ((model.rank.max - 1) * step) / 2;
    for (let i = 0; i < model.rank.max; i++) diamond(ctx, left + i * step, y + 31, 2, i < model.rank.filled ? TIER_COLORS[model.rank.tier] : null, PALETTE.disabled);
  }
  fitted(ctx, model.name, x + 3, y + s - 7, s - 6, model.state === 'poor' ? PALETTE.danger : dim ? PALETTE.textDim : PALETTE.text, 'center');
  if (model.charge) {
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(x + 3, y + s - 3, s - 6, 3);
    ctx.fillStyle = [PALETTE.textDim, PALETTE.cursor, PALETTE.eclipseGlow][model.charge.level] ?? PALETTE.eclipseGlow;
    ctx.fillRect(x + 3, y + s - 3, Math.round((s - 6) * model.charge.fill), 3);
  }
  if (model.state === 'busy') {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(nowMs / 110);
    ctx.strokeStyle = PALETTE.cursor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1.5, y + 1.5, s - 3, s - 3);
    ctx.globalAlpha = 1;
  }
}

function moveSlots(ctx: Ctx, state: WorldState, screen: HudSize, view: CombatView): void {
  const { player } = state;
  const count = slotCount(player.loadout);
  PLAYER_SLOT_LAYOUT.forEach((_, index) => {
    if (index >= count) return;
    slotWindow(ctx, moveSlotModel(player, index, view.device, view.pad), slotRect(screen, index, count), view.nowMs);
  });
}

// -- Boss bar -----------------------------------------------------------------------------------------------------

interface BossLayout {
  nameSize: number;
  spacing: number;
  nameBase: number;
  epiBase: number;
  barY: number;
  barH: number;
}

const BOSS_LAYOUT: Record<HudVariant, BossLayout> = {
  regular: { nameSize: 22, spacing: 2, nameBase: 19, epiBase: 36, barY: 44, barH: 10 },
  compact: { nameSize: 16, spacing: 1, nameBase: 14, epiBase: 27, barY: 34, barH: 8 },
};

/** One type badge: a diamond in the type's colours with its initial. */
function typeBadge(ctx: Ctx, type: keyof typeof TYPE_COLORS, x: number, y: number): void {
  const c = TYPE_COLORS[type];
  const cx = x + 8;
  const cy = y + 8;
  ctx.beginPath();
  ctx.moveTo(cx, y);
  ctx.lineTo(x + 16, cy);
  ctx.lineTo(cx, y + 16);
  ctx.lineTo(x, cy);
  ctx.closePath();
  ctx.fillStyle = PALETTE.ink;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, y + 1.5);
  ctx.lineTo(x + 14.5, cy);
  ctx.lineTo(cx, y + 14.5);
  ctx.lineTo(x + 1.5, cy);
  ctx.closePath();
  ctx.fillStyle = c.core;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = c.edge;
  ctx.stroke();
  const label = t(`type.${type}`).slice(0, 1).toUpperCase();
  ctx.font = canvasFont();
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(label, cx + 1, cy + 4);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(label, cx, cy + 3);
}

/** The first living boss's bar, bottom centre: name caps, epithet, status icons, the gilt bar with chip trail and phase notches, card pips and clock. */
function bossBlock(ctx: Ctx, state: WorldState, screen: HudSize, view: CombatView): void {
  const variant = hudVariant(screen);
  const lay = BOSS_LAYOUT[variant];
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

  // Name and epithet fade in first; the frame follows.
  ctx.globalAlpha = stage.enter;
  const nameW = spaced(ctx, model.name.toUpperCase(), bx, y + lay.nameBase, PALETTE.text, lay.nameSize, lay.spacing, 'left');
  // Right end of the name row: the boss's type, then its statuses.
  let ix = x + w - 4;
  for (const status of [...model.statuses].reverse()) {
    ix -= 17;
    drawIcon(ctx, COMBAT_ICONS[STATUS_ICON[status]]!, ix, y + lay.nameBase - 14, 1);
  }
  if (model.type) {
    ix -= 19;
    typeBadge(ctx, model.type, ix, y + lay.nameBase - 14);
  }
  void nameW;
  // Epithet (the lore line), the stance in play after it.
  const epithet = model.tag ? `${model.epithet} · ${model.tag}` : model.epithet;
  fitted(ctx, epithet, bx, y + lay.epiBase, Math.max(120, bw - 120), herald ? herald.colour : PALETTE.textDim);
  // Card pips with the seal, and the card clock, at the right end of the epithet row.
  let rx = x + w - 4;
  if (model.clock) {
    const label = t('hud.cooldown').replace('{s}', String(model.clock.seconds));
    outlined(ctx, label, rx, y + lay.epiBase, model.clock.urgent ? PALETTE.danger : PALETTE.textDim, 11, 'right');
    rx -= widthOf(ctx, label) + 17;
    drawIcon(ctx, COMBAT_ICONS.hourglass!, rx, y + lay.epiBase - 12, 1, model.clock.urgent ? 1 : 0.7);
    rx -= 6;
  }
  if (model.pips) {
    for (let i = model.pips.length - 1; i >= 0; i--) {
      rx -= 9;
      const pip = model.pips[i]!;
      diamond(ctx, rx + 3, y + lay.epiBase - 4, 3, pip === 'done' ? PALETTE.disabled : pip === 'live' ? PALETTE.cursor : null, PALETTE.textDim);
    }
    rx -= 18;
    drawIcon(ctx, COMBAT_ICONS.seal!, rx + 3, y + lay.epiBase - 12, 1, 0.8);
  }

  // The gilt bar.
  ctx.globalAlpha = Math.min(1, stage.enter * 2);
  const colour = herald ? herald.colour : model.guarded ? '#8fb3ff' : PALETTE.eclipse;
  const by = y + lay.barY;
  relicBar(ctx, bx, by, bw, lay.barH, shownFill, chip, colour);
  // Ornaments at both ends: a gilt diamond on the frame.
  for (const ex of [bx - 5, bx + bw + 5]) diamond(ctx, ex, by + lay.barH / 2, 3, GOLD, GOLD);
  // Phase notches: a tick where each card's segment ends (passed ones dim, the next one pulses in "tu turno").
  for (const notch of model.notches) {
    const nx = Math.round(bx + bw * notch.at);
    ctx.globalAlpha = notch.passed ? 0.35 : 1;
    ctx.fillStyle = notch.live ? PALETTE.cursor : PALETTE.text;
    ctx.fillRect(nx, by - 3, 1, lay.barH + 6);
    ctx.fillRect(nx - 1, by - 3, 3, 1);
    ctx.fillRect(nx - 1, by + lay.barH + 2, 3, 1);
  }
  ctx.globalAlpha = 1;
}

/** "GUARDIÁN CAÍDO": the dark band across the lower third, the name carved in gold, fading in and out. */
function defeatBanner(ctx: Ctx, defeat: NonNullable<ReturnType<BossStage['update']>['defeat']>, screen: HudSize, variant: HudVariant, nowMs: number): void {
  void nowMs;
  const a = defeat.alpha;
  const cy = Math.round(screen.height * 0.6);
  const h = variant === 'regular' ? 62 : 44;
  const band = ctx.createLinearGradient(0, 0, screen.width, 0);
  band.addColorStop(0, 'rgba(5,4,7,0)');
  band.addColorStop(0.2, 'rgba(5,4,7,0.78)');
  band.addColorStop(0.8, 'rgba(5,4,7,0.78)');
  band.addColorStop(1, 'rgba(5,4,7,0)');
  ctx.globalAlpha = a;
  ctx.fillStyle = band;
  ctx.fillRect(0, cy - h / 2, screen.width, h);
  ctx.fillStyle = GOLD;
  const rule = Math.round(Math.min(screen.width * 0.6, 360) * Math.min(1, a * 1.4));
  ctx.fillRect(Math.round(screen.width / 2 - rule / 2), cy - h / 2 + 2, rule, 1);
  ctx.fillRect(Math.round(screen.width / 2 - rule / 2), cy + h / 2 - 3, rule, 1);
  const size = variant === 'regular' ? 33 : 22;
  spaced(ctx, t('boss.felled'), screen.width / 2, cy + (variant === 'regular' ? 4 : 2), PALETTE.cursor, size, variant === 'regular' ? 4 : 2, 'center');
  ctx.font = canvasFont();
  outlined(ctx, t(`species.${defeat.species}`), screen.width / 2, cy + h / 2 - 9, PALETTE.textDim, 11, 'center');
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

/** An ornamental bracket for the move name: a gilt bar with serifs and a diamond pointing at the name. */
function bracket(ctx: Ctx, x: number, cy: number, h: number, dir: 1 | -1): void {
  ctx.fillStyle = GOLD;
  ctx.fillRect(x, cy - h / 2, 2, h);
  ctx.fillRect(dir === 1 ? x : x - 6, cy - h / 2, dir === 1 ? 8 : 8, 2);
  ctx.fillRect(dir === 1 ? x : x - 6, cy + h / 2 - 2, 8, 2);
  diamond(ctx, x + dir * 8, cy, 3, PALETTE.eclipseGlow, PALETTE.ink);
}

/**
 * A boss event announced, upper third of the screen (below the location plaque): the move's name large in ember between
 * brackets, its sign under it with a seal, one telegraph cue with its icon. Enters in 180 ms, holds, leaves in 300 ms;
 * under reduced motion it only fades.
 */
export function drawBossCaption(ctx: Ctx, spell: SpellBanner, nowMs: number, screen: HudSize): void {
  const age = nowMs - spell.shownAtMs;
  if (age < 0 || age >= CAPTION_LIFE_MS) return;
  const reduced = prefersReducedMotion();
  const motion = captionMotion(age, reduced);
  if (motion.alpha <= 0) return;
  const variant = hudVariant(screen);
  const caption = (spell.stance ? bossCaption(spell.stance, spell.species ?? null, spell.heraldName) : null) ?? { name: spell.name, sign: spell.title ? spell.title : t('boss.sign.omen'), cue: 'area' as const };
  const cx = screen.width / 2;
  const cy = Math.round(screen.height * (variant === 'regular' ? 0.3 : 0.32));
  const bigSize = variant === 'regular' ? 33 : 22;
  ctx.font = canvasFont(bigSize);
  const maxW = screen.width * 0.82;
  const size = widthOf(ctx, caption.name.toUpperCase(), bigSize) + 4 * caption.name.length > maxW ? (variant === 'regular' ? 22 : 16) : bigSize;
  const spacing = size >= 33 ? 3 : 2;

  ctx.save();
  ctx.globalAlpha = motion.alpha;
  // A dark band behind: the arena stays visible above and below it.
  const bandH = variant === 'regular' ? 88 : 64;
  const band = ctx.createLinearGradient(0, 0, screen.width, 0);
  band.addColorStop(0, 'rgba(5,4,7,0)');
  band.addColorStop(0.18, 'rgba(5,4,7,0.62)');
  band.addColorStop(0.82, 'rgba(5,4,7,0.62)');
  band.addColorStop(1, 'rgba(5,4,7,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, cy - bandH / 2 - 8, screen.width, bandH);
  // The name settles from a little larger, like a seal pressed down.
  ctx.translate(cx, cy);
  const grow = 1 + 0.12 * motion.settle;
  ctx.scale(grow, grow);
  ctx.translate(-cx, -cy);
  const total = spaced(ctx, caption.name.toUpperCase(), cx, cy + Math.round(size / 3), PALETTE.eclipseGlow, size, spacing, 'center', 1);
  const half = total / 2 + 12;
  const bh = Math.round(size * 0.9);
  bracket(ctx, cx - half - 4, cy, bh, -1);
  bracket(ctx, cx + half + 2, cy, bh, 1);
  // The rule draws out from the middle.
  const rule = Math.round((total + 40) * motion.rule);
  ctx.fillStyle = GOLD;
  ctx.fillRect(Math.round(cx - rule / 2), cy + Math.round(size / 3) + 6, rule, 1);
  // The sign: seal icon and "Signo Gema".
  const signY = cy - Math.round(size / 2) - 6;
  const signW = widthOf(ctx, caption.sign.toUpperCase(), 11) + 18;
  drawIcon(ctx, COMBAT_ICONS.seal!, cx - signW / 2, signY - 12, 1);
  outlined(ctx, caption.sign.toUpperCase(), cx - signW / 2 + 18, signY, PALETTE.cursor, 11, 'left');
  // The telegraph cue: its icon and how to read it.
  const cue = BOSS_CUES.includes(caption.cue) ? caption.cue : 'area';
  const hint = t(`boss.cue.${cue}`);
  const hintW = widthOf(ctx, hint, 11) + 20;
  const hintY = cy + Math.round(size / 3) + 24;
  drawIcon(ctx, COMBAT_ICONS[`cue-${cue}`]!, cx - hintW / 2, hintY - 12, 1);
  outlined(ctx, hint, cx - hintW / 2 + 20, hintY, PALETTE.text, 11, 'left');
  ctx.restore();
}

// -- Entry --------------------------------------------------------------------------------------------------------

/** The combat HUD's panels for one frame (the flashes, gate notices and the rest stay with `drawHud`). */
export function drawCombatPanels(ctx: Ctx, state: WorldState, screen: HudSize, view: CombatView): void {
  statusWindow(ctx, state, screen, view);
  partnerFrames(ctx, state, screen, view);
  // Touch: the slot buttons show the moves (src/adapters/touch-slots.ts); no slot windows under the thumbs.
  if (!view.touch) moveSlots(ctx, state, screen, view);
  bossBlock(ctx, state, screen, view);
}
