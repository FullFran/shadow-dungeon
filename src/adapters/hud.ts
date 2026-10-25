import { M0_SLOT_LAYOUT } from '../data/slots';
import { MOVES } from '../data/moves';
import { TUNING } from '../data/tuning';
import { t } from '../i18n';
import { bossBar } from '../core/boss';
import { levelProgress } from '../core/progression';
import type { Rect, WorldState } from '../core/state';
import { JUICE, type FlashKind, type JuiceState } from './juice';

/** Fraction of a bar to fill, clamped to [0, 1]. */
export const barFill = (value: number, max: number): number => (max <= 0 ? 0 : Math.min(1, Math.max(0, value / max)));

/** "Planta 2" / "Floor 2". */
export const floorLabel = (floor: number): string => `${t('hud.floor')} ${floor}`;

/** "¡Mimikyu subió al nivel 3!" / "Mimikyu grew to level 3!". */
export const levelUpText = (species: string, level: number): string =>
  t('hud.levelUp').replace('{name}', t(`species.${species}`)).replace('{level}', String(level));

const FLASH_COLORS: Record<FlashKind, string> = { perfectDodge: '#b9a4ff', disguiseBroken: '#ffd36b', levelUp: '#7fd8ff' };

function flashText(flash: NonNullable<JuiceState['flash']>, species: string): string {
  if (flash.kind === 'levelUp') return levelUpText(species, flash.level ?? 1);
  return flash.kind === 'perfectDodge' ? t('hud.perfectDodge') : t('hud.disguiseBroken');
}

/** Key hint per slot index, from i18n. */
const SLOT_KEYS = ['hud.key.fast', 'hud.key.heavy'];

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: number, color: string): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = '#2b2638';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round(w * fill), h);
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = '#e8e4f0', align: CanvasTextAlign = 'left'): void {
  ctx.textAlign = align;
  ctx.fillStyle = '#000000';
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/**
 * HUD in view units (the caller has applied the pixel scale): HP, stamina,
 * level and XP bar, Disguise state, floor counter, move slots with the charge level, boss bar and flashes.
 */
export function drawHud(ctx: CanvasRenderingContext2D, state: WorldState, juice: JuiceState, view: Rect, floor: number): void {
  const { player } = state;
  ctx.font = 'bold 8px monospace';

  label(ctx, floorLabel(floor), view.width - 8, 14, '#e8e4f0', 'right');

  label(ctx, t('hud.hp'), 8, 14);
  bar(ctx, 34, 8, 90, 7, barFill(player.hp, player.maxHp), player.hp / player.maxHp > 0.3 ? '#5ad16a' : '#e0524a');
  label(ctx, `${Math.ceil(player.hp)}`, 128, 14);
  label(ctx, t('hud.stamina'), 8, 26);
  bar(ctx, 34, 21, 90, 5, barFill(player.stamina, TUNING.stamina.max), '#f2c94c');

  const progress = levelProgress(player.xp);
  label(ctx, `${t('hud.level')} ${player.level}`, 8, 38, '#7fd8ff');
  bar(ctx, 34, 33, 90, 3, progress.fill, '#7fd8ff');

  const disguise = player.disguiseBroken ? t('hud.disguise.broken') : t('hud.disguise.intact');
  label(ctx, `${t('passive.disguise')}: ${disguise}`, 8, 50, player.disguiseBroken ? '#9aa0a6' : '#ffd36b');

  // Move slots, bottom left.
  M0_SLOT_LAYOUT.forEach((_, index) => {
    const moveId = player.loadout[index];
    if (!moveId) return;
    const move = MOVES[moveId];
    const x = 8 + index * 112;
    const y = view.height - 30;
    const busy = player.action?.slotIndex === index;
    const affordable = player.stamina >= move.staminaCost;
    ctx.fillStyle = busy ? 'rgba(120, 90, 200, 0.55)' : 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(x, y, 106, 22);
    label(ctx, t(SLOT_KEYS[index] ?? ''), x + 4, y + 9, '#9aa0a6');
    label(ctx, t(`move.${moveId}`), x + 4, y + 19, affordable ? '#e8e4f0' : '#e0524a');
    const action = player.action;
    if (busy && action?.phase === 'charging' && move.charge) {
      const maxHold = move.charge.at(-1)?.holdMs ?? 1;
      bar(ctx, x + 2, y + 22, 102, 3, barFill(action.chargeMs, maxHold), ['#c9c2dd', '#ffd36b', '#ff8a3d'][action.chargeLevel] ?? '#ff8a3d');
    }
  });

  const boss = bossBar(state);
  if (boss) {
    const w = Math.min(260, view.width - 40);
    const x = (view.width - w) / 2;
    const y = view.height - 52;
    const stance = t(`boss.stance.${boss.stance}`);
    label(ctx, `${t(`species.${boss.species}`)} · ${stance}`, view.width / 2, y - 4, '#e8e4f0', 'center');
    bar(ctx, x, y, w, 6, barFill(boss.hp, boss.maxHp), boss.stance === 'shield' ? '#8fb3ff' : '#ff6b6b');
  }

  if (juice.flash) {
    const life = juice.flash.ageMs / JUICE.flashMs;
    ctx.globalAlpha = 1 - life;
    ctx.font = 'bold 14px monospace';
    label(ctx, flashText(juice.flash, player.species), view.width / 2, 60 - 8 * life, FLASH_COLORS[juice.flash.kind], 'center');
    ctx.globalAlpha = 1;
  }
}
