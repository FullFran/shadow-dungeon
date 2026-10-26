import { heraldBarText } from './herald-vfx';
import type { ItemId, Rarity } from '../data/items';
import { PLAYER_SLOT_LAYOUT } from '../data/slots';
import { MOVES, type MoveId } from '../data/moves';
import { cooldownLeft } from '../core/boosts';
import { SPECIES } from '../data/species';
import { TUNING } from '../data/tuning';
import { t } from '../i18n';
import { bossBar } from '../core/boss';
import { cardInfo } from '../data/cards';
import { cardTimeLeftMs, fightFor, fightOf, inTurn } from '../core/cards';
import { behaviourFor } from '../core/tricks';
import { worldDifficulty } from '../core/difficulty';
import { playerStats } from '../core/items';
import { levelProgress } from '../core/progression';
import type { GateState } from '../core/gates';
import type { EnemyState, PlayerState, Rect, WorldState } from '../core/state';
import { heraldCard, heraldOf } from '../core/herald/brain';
import { drawBar, drawPanel, pixelText } from '../ui/canvas';
import { bossRect, HUD_BOX, slotRect, statusRect } from '../ui/hud-layout';
import { canvasFont, PALETTE, RARITY, TYPE_COLORS } from '../ui/tokens';
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
const SLOT_KEYS = ['hud.key.fast', 'hud.key.heavy', 'hud.key.boost', 'hud.key.area'];

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

/** A slot's cooldown for the HUD: seconds left ("3 s", rounded up) and the share still to run; null when ready. */
export function slotCooldown(player: Pick<PlayerState, 'cooldowns'>, moveId: MoveId): { label: string; fill: number } | null {
  const left = cooldownLeft(player, moveId);
  const total = MOVES[moveId].cooldownMs ?? 0;
  if (left <= 0 || total <= 0) return null;
  return { label: t('hud.cooldown').replace('{s}', String(Math.ceil(left / 1000))), fill: barFill(left, total) };
}

/** How many slot windows the HUD lays out: two while the boost and area slots are empty (the M0 look), else four. */
export const slotCount = (loadout: readonly (string | null)[]): number => (loadout.slice(2).some((m) => m !== null) ? PLAYER_SLOT_LAYOUT.length : 2);

/** Move slots at the bottom right: key hint, move name (red when unaffordable) and the charge bar. */
function moveSlots(ctx: CanvasRenderingContext2D, state: WorldState, screen: HudSize, touch: boolean): void {
  const { player } = state;
  const count = slotCount(player.loadout);
  // Touch: under the status window (clear of the action buttons); the chip makes the status window taller.
  const placement = { touch, chip: itemsChip(player.items.length, touch) !== null };
  PLAYER_SLOT_LAYOUT.forEach((_, index) => {
    const moveId = player.loadout[index];
    if (!moveId) return;
    const move = MOVES[moveId];
    const { x, y, width: w } = slotRect(screen, index, count, placement);
    const busy = player.action?.slotIndex === index;
    const affordable = player.stamina >= move.staminaCost * playerStats(player).staminaCost;
    const cooling = slotCooldown(player, moveId);
    // A boost whose buff is running glows in its type colour.
    const glowing = player.buff?.moveId === moveId;
    drawPanel(ctx, x, y, w, 30, { alpha: 0.9, border: busy ? PALETTE.cursor : glowing ? TYPE_COLORS[move.type].core : PALETTE.border });
    ctx.font = canvasFont();
    pixelText(ctx, t(SLOT_KEYS[index] ?? ''), x + 6, y + 12, PALETTE.textDim);
    pixelText(ctx, t(`move.${moveId}`), x + 6, y + 24, cooling ? PALETTE.disabled : affordable ? PALETTE.text : PALETTE.danger);
    if (cooling) {
      // The cooldown: seconds left top right and a bar that empties as it runs out.
      pixelText(ctx, cooling.label, x + w - 6, y + 12, PALETTE.cursor, 'right');
      drawBar(ctx, x + 4, y + 30 - 4, w - 8, 2, cooling.fill, PALETTE.textDim);
    }
    const action = player.action;
    if (busy && action?.phase === 'charging' && move.charge) {
      const maxHold = move.charge.at(-1)?.holdMs ?? 1;
      drawBar(ctx, x + 4, y + 30 - 4, w - 8, 2, barFill(action.chargeMs, maxHold), [PALETTE.textDim, PALETTE.cursor, PALETTE.eclipseGlow][action.chargeLevel] ?? PALETTE.eclipseGlow);
    }
  });
}

/** The share of the card in play's timer still to run (the clock ring), or null. */
function cardTimerShare(state: WorldState, enemy: EnemyState): number | null {
  // A herald's card: its own generated timer (its clock is the stance time, core/herald/brain.ts `heraldBar`).
  const herald = heraldOf(state, enemy);
  if (herald) {
    const card = heraldCard(herald, enemy.boss?.stance);
    return card && enemy.boss ? Math.max(0, Math.min(1, 1 - enemy.boss.stanceMs / card.timerMs)) : null;
  }
  const fight = fightFor(state, fightOf(behaviourFor(enemy.species, worldDifficulty(state))));
  if (!fight || enemy.boss?.card === undefined) return null;
  const card = fight.cards[enemy.boss.card];
  const left = cardTimeLeftMs(fight, enemy);
  return card && left !== null ? Math.max(0, Math.min(1, left / card.timerMs)) : null;
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
  moveSlots(ctx, state, screen, touch);

  const boss = bossBar(state);
  if (boss) {
    const box = bossRect(screen);
    const { x, width: w } = box;
    const y = box.y + HUD_BOX.bossNameHeight;
    const name = t(`species.${boss.species}`);
    ctx.font = canvasFont();
    // A herald names itself and its card count (adapters/herald-vfx.ts) and wears its theme's colour; every card boss shares the notches and the clock.
    const herald = heraldBarText(state, boss.enemyId);
    pixelText(ctx, herald ? herald.label : boss.stance ? `${name} · ${t(`boss.stance.${boss.stance}`)}` : name, screen.width / 2, y - 5, PALETTE.text, 'center');
    const guarded = boss.stance === 'shield' || cardInfo(boss.stance)?.guard === 'front';
    drawBar(ctx, x, y, w, 6, barFill(boss.hp, boss.maxHp), herald ? herald.colour : guarded ? '#8fb3ff' : PALETTE.eclipse);
    // Spell cards read as a souls boss's phases: a notch where each card's segment ends (the ones already passed dim),
    // the notch of the card in play pulses during "tu turno", and the card's clock is a discreet ring by the name (host).
    const enemy = state.enemies.find((e) => e.id === boss.enemyId);
    const turn = enemy !== undefined && inTurn(enemy);
    if (boss.segments) {
      const next = boss.segments.find((at) => at < boss.hp - 0.5);
      for (const at of boss.segments) {
        const nx = Math.round(x + (w * at) / boss.maxHp);
        const passed = at >= boss.hp - 0.5;
        const live = at === next;
        ctx.globalAlpha = passed ? 0.35 : live && turn ? 0.55 + 0.45 * Math.sin(performance.now() / 90) : 1;
        ctx.fillStyle = live ? PALETTE.cursor : PALETTE.text;
        ctx.fillRect(nx, y - 3, 1, 12);
        ctx.fillRect(nx - 1, y - 3, 3, 1);
        ctx.fillRect(nx - 1, y + 8, 3, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (boss.cardLeftMs !== undefined) {
      const left = enemy ? cardTimerShare(state, enemy) : null;
      const share = left ?? 0;
      const r = 4;
      const cx = x + w + r + 3;
      const cy = y + 3;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = PALETTE.textDim;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = boss.cardLeftMs <= 5000 ? '#ff7a6a' : PALETTE.textDim;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * share);
      ctx.stroke();
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

/** Draws the "gate opened" notice, fading out over its last second. */
export function drawGateNotice(ctx: CanvasRenderingContext2D, notice: GateNotice, width: number, y: number, timeMs: number): void {
  const age = timeMs - notice.atMs;
  if (age < 0 || age >= GATE_NOTICE_MS) return;
  const fade = Math.min(1, (GATE_NOTICE_MS - age) / 1000);
  gateBanner(ctx, gateNoticeText(notice.kind), PALETTE.cursor, { panel: 0.85 * fade, text: fade }, width, y);
}
