import type { Bilingual, HeraldLayerKind } from '../../data/herald';
import { ADJECTIVES, DOMAINS, EPIGRAPHS, NAME_SYLLABLES, PATTERN_NOUNS, SIGN_THEMES, TITLES } from '../../data/herald-words';
import type { PokemonType } from '../../data/types';
import type { Rand } from './rand';

/**
 * A herald's names, composed from data/herald-words.ts: its own name from
 * syllables ("Vaelthis"), an epithet («el Guardián de las Mareas Rotas» /
 * "the Warden of the Broken Tides"), an epigraph, and its card names
 * («Signo Abisal «Vórtice Hundido»» / Abyss Sign "Sunken Vortex").
 */
export interface HeraldWords {
  name: string;
  epithet: Bilingual;
  epigraph: Bilingual;
  /** The domain and adjective indices, reused by the card names so a herald's cards share its voice. */
  domain: number;
  adjective: number;
}

const capitalised = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function properName(rand: Rand): string {
  const start = rand.pick(NAME_SYLLABLES.start);
  const middle = rand.chance(0.55) ? rand.pick(NAME_SYLLABLES.middle) : '';
  const end = rand.pick(NAME_SYLLABLES.end);
  // No doubled letter across a join ("Mor" + "ra" -> "Mora").
  const joined = [start, middle, end].reduce((acc, part) => (part && acc.slice(-1).toLowerCase() === part.charAt(0).toLowerCase() ? acc + part.slice(1) : acc + part), '');
  return capitalised(joined.toLowerCase());
}

export function heraldWords(rand: Rand): HeraldWords {
  const name = properName(rand);
  const title = rand.pick(TITLES);
  const domain = rand.int(0, DOMAINS.length - 1);
  const adjective = rand.int(0, ADJECTIVES.length - 1);
  const d = DOMAINS[domain]!;
  const a = ADJECTIVES[adjective]!;
  const article = d.g === 'f' ? 'las' : 'los';
  const epithet: Bilingual = { es: `${title.es} de ${article} ${d.es} ${d.g === 'f' ? a.fp : a.mp}`, en: `${title.en} of the ${a.en} ${d.en}` };
  const line = rand.pick(EPIGRAPHS);
  const epigraph: Bilingual = { es: capitalised(line.es.replace('{d}', `${article} ${d.es.toLowerCase()}`)), en: capitalised(line.en.replace('{d}', `the ${d.en.toLowerCase()}`)) };
  return { name, epithet, epigraph, domain, adjective };
}

/** «Signo Abisal «Vórtice Hundido»» / Abyss Sign "Sunken Vortex". */
export function cardName(rand: Rand, type: PokemonType, kind: HeraldLayerKind): Bilingual {
  const sign = SIGN_THEMES[type];
  const noun = rand.pick(PATTERN_NOUNS[kind]);
  const a = rand.pick(ADJECTIVES);
  return { es: `${sign.es} «${noun.es} ${noun.g === 'f' ? a.fs : a.ms}»`, en: `${sign.en} "${a.en} ${noun.en}"` };
}
