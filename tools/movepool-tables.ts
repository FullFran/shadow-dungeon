/**
 * `npx vite-node tools/movepool-tables.ts`: prints the per-species move
 * tables of docs/gdd.md «Movimientos y maestro» (Spanish names, slot, type,
 * power, effect and price) from the data, so the GDD never drifts by hand.
 */
import { MOVES, type MoveId } from '../src/data/moves';
import { originalKit, SPECIES } from '../src/data/species';
import { movePrice, moveTier, RANK_COSTS_BY_TIER, RECOMMENDED_BUILD, unlockOf } from '../src/data/tutor';
import { RANK_EFFECTS } from '../src/data/rank-effects';
import { dungeonById } from '../src/data/dungeons';
import { rankEffectText, tierName } from '../src/app/tutor';
import { moveShape } from '../src/app/move-info';
import { catalog, setLanguage } from '../src/i18n';

setLanguage('es');

const es = catalog('es');
const SLOT: Record<string, string> = { fast: 'Rápido', heavy: 'Fuerte', boost: 'Potenciación', area: 'Área' };

function effect(id: MoveId): string {
  const m = MOVES[id];
  const parts: string[] = [es[`loadout.shape.${moveShape(m).shape}`] ?? moveShape(m).shape];
  if (m.multiHit) parts.push(`×${m.multiHit}`);
  if (m.hitbox.kind === 'projectile' && m.hitbox.homing) parts.push('teledirigido');
  if (m.hitbox.kind === 'projectile' && m.hitbox.linger) parts.push(`zona que repite cada ${m.hitbox.linger} ms`);
  if (m.drain) parts.push(`drena ${Math.round(m.drain * 100)} %`);
  if (m.recoil) parts.push(`retroceso ${Math.round(m.recoil * 100)} %`);
  if (m.dot) parts.push(m.dot === 'burn' ? 'quema' : 'envenena');
  if (m.critBonus) parts.push(`+${Math.round(m.critBonus * 100)} % crítico`);
  if (m.bonus) parts.push(`×${m.bonus.multiplier} si ${m.bonus.when === 'attacking' ? 'el enemigo ataca' : m.bonus.when === 'staggered' ? 'está aturdido' : 'fallaste antes'}`);
  if (m.hpCost) parts.push(`cuesta ${Math.round(m.hpCost * 100)} % PS`);
  if (m.buff) {
    const b = m.buff;
    if (b.kind === 'power') parts.push(`${b.hits} golpes ×${b.multiplier}`);
    if (b.kind === 'haste') parts.push(`velocidad ×${b.speed}, +${Math.round(b.critChance * 100)} % crítico`);
    if (b.kind === 'guard') parts.push(`daño recibido ×${b.damageTaken}`);
    if (b.kind === 'focus') parts.push(`daño ×${b.multiplier}, recibido ×${b.damageTaken}`);
    if (b.kind === 'kindle') parts.push('activa Absorbe Fuego');
    if ('durationMs' in b) parts.push(`${b.durationMs / 1000} s`);
  }
  if (m.hitstunMs >= 400 && m.slot === 'fast') parts.push('aturde mucho');
  if (m.windupMs <= 50) parts.push('prioridad');
  if (m.cooldownMs) parts.push(`enfr. ${m.cooldownMs / 1000} s`);
  if (m.staminaCost) parts.push(`est. ${m.staminaCost}`);
  return parts.join(', ');
}

const order = ['fast', 'heavy', 'boost', 'area'];
for (const id of ['mimikyu', 'zorua', 'litwick', 'cubone'] as const) {
  console.log(`\n#### ${es[`species.${id}`]}\n`);
  console.log('| Movimiento | Hueco | Nivel | Tipo | Potencia | Efecto | Precio (Mejoras) | Rango +1 | Rango +2 |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  const kit = originalKit(id);
  const rows = [...SPECIES[id].movepool].sort((a, b) => order.indexOf(MOVES[a].slot) - order.indexOf(MOVES[b].slot));
  for (const m of rows) {
    const mv = MOVES[m];
    const ranks = RANK_COSTS_BY_TIER[moveTier(m)].join(' / ');
    const lock = unlockOf(m) ? `, tras ${es[dungeonById(unlockOf(m)).lore.nameKey]}` : '';
    const price = kit.includes(m) ? `inicial (${ranks})` : `${movePrice(mv)} P${lock} (${ranks})`;
    const [one, two] = RANK_EFFECTS[m].map(rankEffectText);
    console.log(`| ${es[`move.${m}`]} | ${SLOT[mv.slot]} | ${tierName(moveTier(m))} | ${es[`type.${mv.type}`]} | ${mv.power || '—'} | ${effect(m)} | ${price} | ${one} | ${two} |`);
  }
  console.log(`\nBuild recomendado: ${RECOMMENDED_BUILD[id].map((m) => es[`move.${m}`]).join(' · ')}.`);
}
