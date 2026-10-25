import type { CoinBreakdown } from '../core/coins';

/** "12 P" through the i18n template `hud.coins` (`tr` is the i18n lookup). */
export const coinText = (coins: number, tr: (key: string) => string): string => tr('hud.coins').replace('{coins}', String(coins));

/**
 * The end screen's Pokémonedas lines: each earning line that paid something,
 * the share kept on defeat, the total earned and the new balance.
 */
export function coinLines(coins: CoinBreakdown, balance: number, tr: (key: string) => string): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  const add = (key: string, amount: number) => {
    if (amount > 0) lines.push({ label: tr(`screen.coins.${key}`), value: coinText(amount, tr) });
  };
  add('floors', coins.floors);
  add('enemies', coins.enemies);
  add('escapes', coins.escapes);
  add('guardian', coins.guardian);
  add('time', coins.time);
  if (coins.share < 1) lines.push({ label: tr('screen.coins.share').replace('{pct}', String(Math.round(coins.share * 100))), value: `−${coinText(coins.subtotal - Math.floor(coins.subtotal * coins.share), tr)}` });
  if (coins.multiplier !== 1) lines.push({ label: tr('screen.coins.multiplier'), value: `×${coins.multiplier}` });
  lines.push({ label: tr('screen.coins.total'), value: `+${coinText(coins.total, tr)}` });
  lines.push({ label: tr('screen.coins.balance'), value: coinText(balance, tr) });
  return lines;
}
