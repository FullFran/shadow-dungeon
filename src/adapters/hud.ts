import type { ItemId, Rarity } from '../data/items';
import { PLAYER_SLOT_LAYOUT } from '../data/slots';
import { MOVES, type MoveId } from '../data/moves';
import { cooldownLeft } from '../core/boosts';
import { SPECIES } from '../data/species';
import { t } from '../i18n';
import type { GateState } from '../core/gates';
import type { PlayerState, Rect, WorldState } from '../core/state';
import { drawPanel, pixelText } from '../ui/canvas';
import { toastRect, type HudBox } from '../ui/hud-layout';
import { canvasFont, PALETTE, RARITY, TIER_COLORS } from '../ui/tokens';
import { MAX_RANK, moveTier } from '../data/tutor';
import { JUICE, type FlashKind, type JuiceState } from './juice';

/** Fraction of a bar to fill, clamped to [0, 1]. */
export const barFill = (value: number, max: number): number => (max <= 0 ? 0 : Math.min(1, Math.max(0, value / max)));

/** "Planta 2" / "Floor 2". */
export const floorLabel = (floor: number): string => `${t('hud.floor')} ${floor}`;

/** "¡Mimikyu subió al nivel 3!" / "Mimikyu grew to level 3!". */
export const levelUpText = (species: string, level: number): string =>
  t('hud.levelUp').replace('{name}', t(`species.${species}`)).replace('{level}', String(level));

const FLASH_COLORS: Record<FlashKind, string> = { perfectDodge: '#c9b8ff', disguiseBroken: PALETTE.cursor, levelUp: PALETTE.xp, item: PALETTE.good, passive: PALETTE.eclipseGlow };

/** Rarity colours from the design tokens, shared by the pick cards and the menus. */
export const RARITY_COLORS: Record<Rarity, string> = RARITY;

/** The Mystery Dungeon-style top line: "Planta 2 · Nv. 5 · PS 52/100" (HP rounded up, as the bar shows it). */
export const hudLine = (floor: number, level: number, hp: number, maxHp: number): string =>
  `${floorLabel(floor)} · ${t('hud.level')} ${level} · ${t('hud.hp')} ${Math.ceil(Math.max(0, hp))}/${Math.ceil(maxHp)}`;

export interface HeldItem {
  id: ItemId;
  name: string;
  description: string;
  count: number;
}

/** Held items, one entry per item with its stacks, in pick order (HUD and Esc menu). */
export function heldItems(items: readonly ItemId[]): HeldItem[] {
  const out: HeldItem[] = [];
  for (const id of items) {
    const known = out.find((h) => h.id === id);
    if (known) known.count++;
    else out.push({ id, name: t(`item.${id}`), description: t(`item.${id}.description`), count: 1 });
  }
  return out;
}

/** The toast's short line: the message log keeps the long ones ("¡Mimikyu subió al nivel 3!"). */
export function flashText(flash: NonNullable<JuiceState['flash']>): string {
  if (flash.kind === 'levelUp') return t('hud.toast.levelUp').replace('{level}', String(flash.level ?? 1));
  if (flash.kind === 'item') return t('hud.itemTriggered').replace('{item}', t(`item.${flash.item ?? ''}`));
  if (flash.kind === 'passive') return t('hud.passiveTriggered').replace('{passive}', t(`passive.${flash.passive ?? ''}`));
  return flash.kind === 'perfectDodge' ? t('hud.perfectDodge') : t('hud.toast.disguiseBroken');
}

/** "12 P": Pokémonedas earned so far this run. */
export const coinsLabel = (coins: number): string => t('hud.coins').replace('{coins}', String(Math.max(0, Math.floor(coins))));

/**
 * The held-items line of the status window: just the count ("Objetos
 * equipados ×12 · Esc"); the items themselves are listed in the Esc menu.
 * Touch has no Esc key (the menu button opens it). Null without items.
 */
export function itemsChip(count: number, touch: boolean): string | null {
  if (count <= 0) return null;
  return `${t('pause.items')} ×${count}${touch ? '' : ' · Esc'}`;
}

/**
 * The passive line of the status window: Disguise and Illusion are intact or
 * broken for the room, Flash Fire is waiting or has powered up the next heavy
 * move, Battle Armor is always ready (it acts during heavy wind-ups).
 */
export function passiveStatus(player: Pick<PlayerState, 'species' | 'disguiseBroken' | 'illusionBroken' | 'flashFire'>): { text: string; ready: boolean } {
  const passive = SPECIES[player.species].passive ?? 'disguise';
  const [ready, key] =
    passive === 'disguise'
      ? [!player.disguiseBroken, player.disguiseBroken ? 'hud.disguise.broken' : 'hud.disguise.intact']
      : passive === 'illusion'
        ? [!player.illusionBroken, player.illusionBroken ? 'hud.illusion.broken' : 'hud.illusion.intact']
        : passive === 'flash-fire'
          ? [player.flashFire, player.flashFire ? 'hud.passive.boosted' : 'hud.passive.waiting']
          : [true, 'hud.passive.ready'];
  return { text: `${t(`passive.${passive}`)}: ${t(key)}`, ready };
}

/** A slot's cooldown for the HUD: seconds left ("3 s", rounded up) and the share still to run; null when ready. */
export function slotCooldown(player: Pick<PlayerState, 'cooldowns'>, moveId: MoveId): { label: string; fill: number } | null {
  const left = cooldownLeft(player, moveId);
  const total = MOVES[moveId].cooldownMs ?? 0;
  if (left <= 0 || total <= 0) return null;
  return { label: t('hud.cooldown').replace('{s}', String(Math.ceil(left / 1000))), fill: barFill(left, total) };
}

/** How many slot windows the HUD lays out: two while the boost and area slots are empty (the M0 look), else four. */
export const slotCount = (loadout: readonly (string | null)[]): number => (loadout.slice(2).some((m) => m !== null) ? PLAYER_SLOT_LAYOUT.length : 2);

/** One rank pip of a slot window: a small diamond, filled once that Mejora is bought. */
export interface RankPip {
  x: number;
  y: number;
  size: number;
  filled: boolean;
}

/** Pip size and step (HUD px): Pixelify Sans has no ★, so the ranks are drawn as shapes, like the cursor. */
const PIP = { size: 5, gap: 2, inset: 6, top: 5 } as const;

/**
 * The rank of the move in a slot window, as pure layout: MAX_RANK diamonds at
 * the top right (the key-hint line), the bought ranks filled first, in the
 * move's tier colour; `cooldownRight` is where the cooldown label ends so it
 * clears them. Null for an unranked move, so a plain run's HUD is unchanged.
 */
export function slotRankPips(player: Pick<PlayerState, 'moveRanks'>, moveId: MoveId, slot: Pick<HudBox, 'x' | 'y' | 'width'>): { pips: RankPip[]; colour: string; cooldownRight: number } | null {
  const rank = Math.min(MAX_RANK, Math.max(0, Math.floor(player.moveRanks?.[moveId] ?? 0)));
  if (rank <= 0) return null;
  const step = PIP.size + PIP.gap;
  const left = slot.x + slot.width - PIP.inset - MAX_RANK * step + PIP.gap;
  const pips = Array.from({ length: MAX_RANK }, (_, i) => ({ x: left + i * step, y: slot.y + PIP.top, size: PIP.size, filled: i < rank }));
  return { pips, colour: TIER_COLORS[moveTier(moveId)], cooldownRight: left - 3 };
}

/** Width and height of the HUD space (src/ui/hud-layout.ts). */
type HudSize = Pick<Rect, 'width' | 'height'>;

/** How the toast fades: in over 120 ms, out over its last 400 ms, so the 1.6 s flash never pops. */
export function toastAlpha(ageMs: number, lifeMs: number = JUICE.flashMs): number {
  if (ageMs < 0 || ageMs >= lifeMs) return 0;
  return Math.min(1, ageMs / 120, (lifeMs - ageMs) / 400);
}

/**
 * The flash toast in HUD-space units (the caller has applied the HUD scale; fix pass 3, owner 2026-11-04: nothing flashes in
 * the middle of the arena): "perfect dodge", "disguise broken", "level up", an item or a passive acting show as one small
 * plate under the status block for 1.6 s. The panels (status window, co-op frames, move slots, boss bar) are drawn by
 * `drawCombatPanels` (src/adapters/combat-hud.ts); the minimap and the message log by their own modules.
 */
export function drawFlashToast(ctx: CanvasRenderingContext2D, state: WorldState, juice: JuiceState, screen: HudSize, view: { touch: boolean }): void {
  const flash = juice.flash;
  if (!flash) return;
  const alpha = toastAlpha(flash.ageMs);
  if (alpha <= 0) return;
  const box = toastRect(screen, { partners: state.remotes.length, touch: view.touch });
  const text = flashText(flash);
  ctx.save();
  ctx.globalAlpha = alpha;
  drawPanel(ctx, box.x, box.y, box.width, box.height, { alpha: 0.85, fill: 0.8 });
  ctx.font = canvasFont();
  const squeeze = Math.min(1, (box.width - 10) / Math.max(1, ctx.measureText(text).width));
  ctx.translate(box.x + box.width / 2, 0);
  ctx.scale(squeeze, 1);
  pixelText(ctx, text, 0, box.y + box.height - 4, FLASH_COLORS[flash.kind], 'center');
  ctx.restore();
}

/** The line of the floor's gate (core/gates.ts) while it holds: what keeps the stairs shut. */
export function gateText(gate: Pick<GateState, 'kind'>): string {
  if (gate.kind === 'key') return t('gate.key.hud');
  return t(gate.kind === 'waves' ? 'gate.waves.hud' : 'gate.seal.hud');
}

/** How long the "gate opened" notice shows (ms). */
export const GATE_NOTICE_MS = 3500;

/** A seal or key gate just opened by its enemy's fall: what the notice says and which doorways flash on the minimap. */
export interface GateNotice {
  kind: 'seal' | 'key';
  doors: readonly number[];
  atMs: number;
}

/**
 * Frame to frame (host and guest alike, the guest's gate follows the
 * snapshot): a notice the moment a seal or key gate goes from shut to opened.
 * Nothing for a wave room, a broken gate, or a gate already open.
 */
export function gateNotice(before: Pick<GateState, 'done'> | undefined, now: GateState | undefined, timeMs: number): GateNotice | null {
  if (!before || before.done || !now || !now.done || now.outcome !== 'opened' || now.kind === 'waves') return null;
  return { kind: now.kind, doors: now.doors ?? [], atMs: timeMs };
}

/** The notice's line: the key taken and the door opening, or the seal broken. */
export const gateNoticeText = (kind: GateNotice['kind']): string => t(kind === 'key' ? 'gate.key.taken' : 'gate.seal.opened');

/** Draws a gate line centred at `y` (HUD units), in a small window. */
function gateBanner(ctx: CanvasRenderingContext2D, text: string, color: string, look: { panel: number; text: number }, width: number, y: number): void {
  ctx.font = canvasFont();
  const w = Math.ceil(ctx.measureText(text).width) + 20;
  drawPanel(ctx, Math.round(width / 2 - w / 2), Math.round(y - 11), w, 18, { alpha: look.panel, fill: 0.8 });
  ctx.globalAlpha = look.text;
  pixelText(ctx, text, width / 2, y + 2, color, 'center');
  ctx.globalAlpha = 1;
}

/** Draws the gate's line centred at `y` (HUD units), in a small window. */
export function drawGateLine(ctx: CanvasRenderingContext2D, gate: Pick<GateState, 'kind'>, width: number, y: number, timeMs: number): void {
  gateBanner(ctx, gateText(gate), PALETTE.danger, { panel: 0.85, text: 0.75 + 0.25 * Math.sin(timeMs / 240) }, width, y);
}

/** Draws the co-op gather line ("Esperando a 2") centred at `y` (HUD units). */
export function drawWaitLine(ctx: CanvasRenderingContext2D, text: string, width: number, y: number): void {
  gateBanner(ctx, text, PALETTE.cursor, { panel: 0.85, text: 1 }, width, y);
}

/** Draws the "gate opened" notice, fading out over its last second. */
export function drawGateNotice(ctx: CanvasRenderingContext2D, notice: GateNotice, width: number, y: number, timeMs: number): void {
  const age = timeMs - notice.atMs;
  if (age < 0 || age >= GATE_NOTICE_MS) return;
  const fade = Math.min(1, (GATE_NOTICE_MS - age) / 1000);
  gateBanner(ctx, gateNoticeText(notice.kind), PALETTE.cursor, { panel: 0.85 * fade, text: fade }, width, y);
}
