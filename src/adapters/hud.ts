import type { ItemId, Rarity } from '../data/items';
import { M0_SLOT_LAYOUT } from '../data/slots';
import { MOVES } from '../data/moves';
import { SPECIES } from '../data/species';
import { TUNING } from '../data/tuning';
import { t } from '../i18n';
import { bossBar } from '../core/boss';
import { cardInfo } from '../data/cards';
import { playerStats } from '../core/items';
import { levelProgress } from '../core/progression';
import type { PlayerState, Rect, WorldState } from '../core/state';
import { drawBar, drawPanel, pixelText } from '../ui/canvas';
import { bossRect, HUD_BOX, slotRect, statusRect } from '../ui/hud-layout';
import { canvasFont, PALETTE, RARITY } from '../ui/tokens';
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

function flashText(flash: NonNullable<JuiceState['flash']>, species: string): string {
  if (flash.kind === 'levelUp') return levelUpText(species, flash.level ?? 1);
  if (flash.kind === 'item') return t('hud.itemTriggered').replace('{item}', t(`item.${flash.item ?? ''}`));
  if (flash.kind === 'passive') return t('hud.passiveTriggered').replace('{passive}', t(`passive.${flash.passive ?? ''}`));
  return flash.kind === 'perfectDodge' ? t('hud.perfectDodge') : t('hud.disguiseBroken');
}

/** "12 P": Pokémonedas earned so far this run. */
export const coinsLabel = (coins: number): string => t('hud.coins').replace('{coins}', String(Math.max(0, Math.floor(coins))));

/** Key hint per slot index, from i18n. */
const SLOT_KEYS = ['hud.key.fast', 'hud.key.heavy'];

const PAD = 7;

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

/** The top-left window: floor / level / HP line, HP, stamina and XP bars, passive, held-items count. */
function statusPanel(ctx: CanvasRenderingContext2D, state: WorldState, floor: number, coins: number | undefined, touch: boolean): void {
  const { player } = state;
  const chip = itemsChip(player.items.length, touch);
  const { x, y, width, height } = statusRect(chip !== null);
  const inner = width - 2 * PAD;
  ctx.font = canvasFont();
  ctx.textAlign = 'left';
  drawPanel(ctx, x, y, width, height, { alpha: 0.92 });

  const low = player.hp / player.maxHp <= 0.3;
  pixelText(ctx, hudLine(floor, player.level, player.hp, player.maxHp), x + PAD, y + 15, PALETTE.text);
  drawBar(ctx, x + PAD, y + 21, inner, 6, barFill(player.hp, player.maxHp), low ? PALETTE.hpLow : PALETTE.hp);
  drawBar(ctx, x + PAD, y + 31, inner, 3, barFill(player.stamina, TUNING.stamina.max), PALETTE.stamina);
  drawBar(ctx, x + PAD, y + 38, inner, 2, levelProgress(player.xp).fill, PALETTE.xp);

  const { text: passiveText, ready: intact } = passiveStatus(player);
  // The passive: a small mask icon, bright while ready.
  ctx.fillStyle = intact ? PALETTE.cursor : PALETTE.disabled;
  ctx.fillRect(x + PAD, y + 45, 7, 6);
  ctx.fillRect(x + PAD + 1, y + 51, 5, 1);
  ctx.fillStyle = PALETTE.ink;
  ctx.fillRect(x + PAD + 1, y + 47, 2, 1);
  ctx.fillRect(x + PAD + 4, y + 47, 2, 1);
  pixelText(ctx, passiveText, x + PAD + 11, y + 52, intact ? PALETTE.cursor : PALETTE.disabled);
  if (coins !== undefined) pixelText(ctx, coinsLabel(coins), x + width - PAD, y + 52, PALETTE.cursor, 'right');
  if (chip) pixelText(ctx, chip, x + PAD, y + 63, PALETTE.textDim);
}

/** Move slots at the bottom right: key hint, move name (red when unaffordable) and the charge bar. */
function moveSlots(ctx: CanvasRenderingContext2D, state: WorldState, screen: HudSize): void {
  const { player } = state;
  M0_SLOT_LAYOUT.forEach((_, index) => {
    const moveId = player.loadout[index];
    if (!moveId) return;
    const move = MOVES[moveId];
    const { x, y, width: w } = slotRect(screen, index, M0_SLOT_LAYOUT.length);
    const busy = player.action?.slotIndex === index;
    const affordable = player.stamina >= move.staminaCost * playerStats(player).staminaCost;
    drawPanel(ctx, x, y, w, 30, { alpha: 0.9, border: busy ? PALETTE.cursor : PALETTE.border });
    ctx.font = canvasFont();
    pixelText(ctx, t(SLOT_KEYS[index] ?? ''), x + 6, y + 12, PALETTE.textDim);
    pixelText(ctx, t(`move.${moveId}`), x + 6, y + 24, affordable ? PALETTE.text : PALETTE.danger);
    const action = player.action;
    if (busy && action?.phase === 'charging' && move.charge) {
      const maxHold = move.charge.at(-1)?.holdMs ?? 1;
      drawBar(ctx, x + 4, y + 30 - 4, w - 8, 2, barFill(action.chargeMs, maxHold), [PALETTE.textDim, PALETTE.cursor, PALETTE.eclipseGlow][action.chargeLevel] ?? PALETTE.eclipseGlow);
    }
  });
}

/** Width and height of the HUD space (src/ui/hud-layout.ts). */
type HudSize = Pick<Rect, 'width' | 'height'>;

/**
 * HUD in HUD-space units (the caller has applied the HUD scale): the status
 * window (floor, level, HP, stamina, XP, Disguise, coins this run, held-items count), move slots
 * with the charge level, boss bar and flashes. The minimap and the message
 * log are drawn by their own modules.
 */
export function drawHud(ctx: CanvasRenderingContext2D, state: WorldState, juice: JuiceState, screen: HudSize, floor: number, coins?: number, touch = false): void {
  const { player } = state;
  statusPanel(ctx, state, floor, coins, touch);
  moveSlots(ctx, state, screen);

  const boss = bossBar(state);
  if (boss) {
    const box = bossRect(screen);
    const { x, width: w } = box;
    const y = box.y + HUD_BOX.bossNameHeight;
    const name = t(`species.${boss.species}`);
    ctx.font = canvasFont();
    pixelText(ctx, boss.stance ? `${name} · ${t(`boss.stance.${boss.stance}`)}` : name, screen.width / 2, y - 5, PALETTE.text, 'center');
    const guarded = boss.stance === 'shield' || cardInfo(boss.stance)?.guard === 'front';
    drawBar(ctx, x, y, w, 6, barFill(boss.hp, boss.maxHp), guarded ? '#8fb3ff' : PALETTE.eclipse);
    // Spell cards: a notch where each card's segment ends, and the card's clock (host) on the right.
    if (boss.segments) {
      ctx.fillStyle = PALETTE.text;
      for (const at of boss.segments) ctx.fillRect(Math.round(x + (w * at) / boss.maxHp), y - 2, 1, 10);
    }
    if (boss.cardLeftMs !== undefined) {
      const seconds = Math.ceil(boss.cardLeftMs / 1000);
      pixelText(ctx, `${seconds}`, x + w, y - 5, seconds <= 5 ? '#ff7a6a' : PALETTE.textDim, 'right');
    }
  }

  if (juice.flash) {
    const life = juice.flash.ageMs / JUICE.flashMs;
    ctx.globalAlpha = 1 - life;
    ctx.font = canvasFont(22, true);
    pixelText(ctx, flashText(juice.flash, player.species), screen.width / 2, 104 - 8 * life, FLASH_COLORS[juice.flash.kind], 'center');
    ctx.globalAlpha = 1;
  }
}
