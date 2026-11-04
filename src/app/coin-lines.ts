import type { CoinBreakdown } from '../core/coins';
import type { EndIconId } from '../ui/icons/end-icons';

export interface CoinLine {
  label: string;
  value: string;
  icon: EndIconId;
  /** The whole figure behind `value` (absent for a share or a multiplier). */
  amount?: number;
}

/** "12 P" through the i18n template `hud.coins` (`tr` is the i18n lookup). */
export const coinText = (coins: number, tr: (key: string) => string): string => tr('hud.coins').replace('{coins}', String(coins));

/**
 * The end screen's Pokémonedas lines: each earning line that paid something,
 * the share kept on defeat, the total earned and the new balance.
 */
export function coinLines(coins: CoinBreakdown, balance: number, tr: (key: string) => string): CoinLine[] {
  const lines: CoinLine[] = [];
  const add = (key: string, amount: number, icon: EndIconId) => {
    if (amount > 0) lines.push({ label: tr(`screen.coins.${key}`), value: coinText(amount, tr), icon, amount });
  };
  add('floors', coins.floors, 'floor');
  add('enemies', coins.enemies, 'sword');
  add('escapes', coins.escapes, 'shield');
  add('guardian', coins.guardian, 'crown');
  add('time', coins.time, 'clock');
  if (coins.share < 1) lines.push({ label: tr('screen.coins.share').replace('{pct}', String(Math.round(coins.share * 100))), value: `−${coinText(coins.subtotal - Math.floor(coins.subtotal * coins.share), tr)}`, icon: 'skull' });
  if (coins.multiplier !== 1) lines.push({ label: tr('screen.coins.multiplier'), value: `×${coins.multiplier}`, icon: 'mode' });
  lines.push({ label: tr('screen.coins.total'), value: `+${coinText(coins.total, tr)}`, icon: 'coin', amount: coins.total });
  lines.push({ label: tr('screen.coins.balance'), value: coinText(balance, tr), icon: 'coin', amount: balance });
  return lines;
}
