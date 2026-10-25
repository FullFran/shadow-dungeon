import type { HeraldLayerKind } from './herald';
import type { PokemonType } from './types';

/**
 * Word lists the heralds' names are composed from (core/herald/names.ts),
 * Spanish and English side by side (same index, same meaning). All of it is
 * our own: no name of any existing game's spell cards, characters or
 * places. Spanish words carry their gender so articles and adjectives agree.
 */
export type Gender = 'm' | 'f';

/** Its own name, from syllables: start + (middle) + end. */
export const NAME_SYLLABLES = {
  start: ['Vael', 'Mor', 'Ner', 'Ith', 'Kael', 'Sel', 'Dra', 'Om', 'Zer', 'Thal', 'Ul', 'Vey', 'Ash', 'Cor', 'Lun', 'Esk', 'Orm', 'Sav', 'Yr', 'Bel'],
  middle: ['a', 'e', 'i', 'o', 'ae', 'ri', 'an', 'el', 'or', 'un', 'is'],
  end: ['th', 'rax', 'mir', 'dra', 'vel', 'nis', 'gor', 'eth', 'ra', 'zul', 'kar', 'ion', 'yss', 'mor', 'ven'],
} as const;

/** "the Warden": the role in its epithet. */
export const TITLES: readonly { es: string; en: string }[] = [
  { es: 'el Guardián', en: 'the Warden' },
  { es: 'la Reina', en: 'the Queen' },
  { es: 'el Heraldo', en: 'the Herald' },
  { es: 'la Señora', en: 'the Lady' },
  { es: 'el Custodio', en: 'the Keeper' },
  { es: 'la Tejedora', en: 'the Weaver' },
  { es: 'el Vigía', en: 'the Watcher' },
  { es: 'la Viuda', en: 'the Widow' },
  { es: 'el Pastor', en: 'the Shepherd' },
  { es: 'la Campanera', en: 'the Bell-Ringer' },
  { es: 'el Juez', en: 'the Judge' },
  { es: 'la Devoradora', en: 'the Devourer' },
  { es: 'el Portador', en: 'the Bearer' },
  { es: 'la Madre', en: 'the Mother' },
  { es: 'el Rey', en: 'the King' },
  { es: 'la Voz', en: 'the Voice' },
];

/** "the Tides": what it keeps (plural). */
export const DOMAINS: readonly { es: string; g: Gender; en: string }[] = [
  { es: 'Mareas', g: 'f', en: 'Tides' },
  { es: 'Lunas', g: 'f', en: 'Moons' },
  { es: 'Cenizas', g: 'f', en: 'Ashes' },
  { es: 'Campanas', g: 'f', en: 'Bells' },
  { es: 'Raíces', g: 'f', en: 'Roots' },
  { es: 'Coronas', g: 'f', en: 'Crowns' },
  { es: 'Espinas', g: 'f', en: 'Thorns' },
  { es: 'Estrellas', g: 'f', en: 'Stars' },
  { es: 'Velas', g: 'f', en: 'Candles' },
  { es: 'Alas', g: 'f', en: 'Wings' },
  { es: 'Sombras', g: 'f', en: 'Shadows' },
  { es: 'Juramentos', g: 'm', en: 'Oaths' },
  { es: 'Ecos', g: 'm', en: 'Echoes' },
  { es: 'Espejos', g: 'm', en: 'Mirrors' },
  { es: 'Huesos', g: 'm', en: 'Bones' },
  { es: 'Faros', g: 'm', en: 'Beacons' },
  { es: 'Relojes', g: 'm', en: 'Clocks' },
  { es: 'Cielos', g: 'm', en: 'Skies' },
  { es: 'Sueños', g: 'm', en: 'Dreams' },
  { es: 'Vientos', g: 'm', en: 'Winds' },
  { es: 'Ríos', g: 'm', en: 'Rivers' },
  { es: 'Cristales', g: 'm', en: 'Crystals' },
  { es: 'Nombres', g: 'm', en: 'Names' },
  { es: 'Soles', g: 'm', en: 'Suns' },
];

/** "Broken": plural forms for the epithet, singular for card names. */
export const ADJECTIVES: readonly { mp: string; fp: string; ms: string; fs: string; en: string }[] = [
  { mp: 'Rotos', fp: 'Rotas', ms: 'Roto', fs: 'Rota', en: 'Broken' },
  { mp: 'Hundidos', fp: 'Hundidas', ms: 'Hundido', fs: 'Hundida', en: 'Sunken' },
  { mp: 'Olvidados', fp: 'Olvidadas', ms: 'Olvidado', fs: 'Olvidada', en: 'Forgotten' },
  { mp: 'Apagados', fp: 'Apagadas', ms: 'Apagado', fs: 'Apagada', en: 'Snuffed' },
  { mp: 'Ahogados', fp: 'Ahogadas', ms: 'Ahogado', fs: 'Ahogada', en: 'Drowned' },
  { mp: 'Quebrados', fp: 'Quebradas', ms: 'Quebrado', fs: 'Quebrada', en: 'Shattered' },
  { mp: 'Dormidos', fp: 'Dormidas', ms: 'Dormido', fs: 'Dormida', en: 'Sleeping' },
  { mp: 'Negros', fp: 'Negras', ms: 'Negro', fs: 'Negra', en: 'Black' },
  { mp: 'Callados', fp: 'Calladas', ms: 'Callado', fs: 'Callada', en: 'Silent' },
  { mp: 'Perdidos', fp: 'Perdidas', ms: 'Perdido', fs: 'Perdida', en: 'Lost' },
  { mp: 'Devorados', fp: 'Devoradas', ms: 'Devorado', fs: 'Devorada', en: 'Devoured' },
  { mp: 'Marchitos', fp: 'Marchitas', ms: 'Marchito', fs: 'Marchita', en: 'Withered' },
  { mp: 'Eternos', fp: 'Eternas', ms: 'Eterno', fs: 'Eterna', en: 'Endless' },
  { mp: 'Huecos', fp: 'Huecas', ms: 'Hueco', fs: 'Hueca', en: 'Hollow' },
  { mp: 'Velados', fp: 'Veladas', ms: 'Velado', fs: 'Velada', en: 'Veiled' },
  { mp: 'Cautivos', fp: 'Cautivas', ms: 'Cautivo', fs: 'Cautiva', en: 'Captive' },
];

/** The card's theme ("Signo Umbrío" / "Umbral Sign") from the herald's type. */
export const SIGN_THEMES: Readonly<Record<PokemonType, { es: string; en: string }>> = {
  normal: { es: 'Signo Pálido', en: 'Pale Sign' },
  ghost: { es: 'Signo Espectral', en: 'Wraith Sign' },
  fairy: { es: 'Signo Hechizado', en: 'Glamour Sign' },
  dark: { es: 'Signo Umbrío', en: 'Umbral Sign' },
  poison: { es: 'Signo Ponzoñoso', en: 'Venom Sign' },
  steel: { es: 'Signo Férreo', en: 'Iron Sign' },
  fire: { es: 'Signo Ígneo', en: 'Ember Sign' },
  ground: { es: 'Signo Telúrico', en: 'Earth Sign' },
  grass: { es: 'Signo Silvestre', en: 'Wildwood Sign' },
  bug: { es: 'Signo del Enjambre', en: 'Swarm Sign' },
  flying: { es: 'Signo Celeste', en: 'Sky Sign' },
  water: { es: 'Signo Abisal', en: 'Abyss Sign' },
  electric: { es: 'Signo Voltaico', en: 'Storm Sign' },
  fighting: { es: 'Signo del Puño', en: 'Fist Sign' },
  rock: { es: 'Signo Pétreo', en: 'Stone Sign' },
};

/** The card's own noun, from its main primitive (singular). */
export const PATTERN_NOUNS: Readonly<Record<HeraldLayerKind, readonly { es: string; g: Gender; en: string }[]>> = {
  ring: [
    { es: 'Corona', g: 'f', en: 'Crown' },
    { es: 'Halo', g: 'm', en: 'Halo' },
    { es: 'Anillo', g: 'm', en: 'Ring' },
  ],
  spiral: [
    { es: 'Espiral', g: 'f', en: 'Spiral' },
    { es: 'Remolino', g: 'm', en: 'Whirl' },
    { es: 'Vórtice', g: 'm', en: 'Vortex' },
  ],
  wave: [
    { es: 'Oleaje', g: 'm', en: 'Swell' },
    { es: 'Serpiente', g: 'f', en: 'Serpent' },
    { es: 'Cinta', g: 'f', en: 'Ribbon' },
  ],
  stream: [
    { es: 'Saeta', g: 'f', en: 'Arrow' },
    { es: 'Dardo', g: 'm', en: 'Dart' },
    { es: 'Lanza', g: 'f', en: 'Spear' },
  ],
  lanes: [
    { es: 'Muralla', g: 'f', en: 'Wall' },
    { es: 'Empalizada', g: 'f', en: 'Palisade' },
    { es: 'Celosía', g: 'f', en: 'Lattice' },
  ],
  closing: [
    { es: 'Cerco', g: 'm', en: 'Siege' },
    { es: 'Abrazo', g: 'm', en: 'Embrace' },
  ],
  scatter: [
    { es: 'Lluvia', g: 'f', en: 'Rain' },
    { es: 'Granizo', g: 'm', en: 'Hail' },
    { es: 'Polvo', g: 'm', en: 'Dust' },
  ],
  homing: [
    { es: 'Luciérnaga', g: 'f', en: 'Firefly' },
    { es: 'Fuego Fatuo', g: 'm', en: 'Wisp' },
    { es: 'Ojo', g: 'm', en: 'Eye' },
  ],
  laser: [
    { es: 'Rayo', g: 'm', en: 'Ray' },
    { es: 'Aguja', g: 'f', en: 'Needle' },
    { es: 'Filo', g: 'm', en: 'Edge' },
  ],
  pockets: [
    { es: 'Hoguera', g: 'f', en: 'Pyre' },
    { es: 'Ocaso', g: 'm', en: 'Dusk' },
  ],
  summon: [
    { es: 'Séquito', g: 'm', en: 'Retinue' },
    { es: 'Coro', g: 'm', en: 'Choir' },
  ],
};

/** One-line epigraphs: `{d}` is the herald's domain with its article ("las Mareas" / "the Tides"). Mythic, terse, the eclipse's lore. */
export const EPIGRAPHS: readonly { es: string; en: string }[] = [
  { es: 'Donde callan {d}, el eclipse escucha.', en: 'Where {d} fall silent, the eclipse listens.' },
  { es: 'Cayó con la última luz y no quiso volver.', en: 'It fell with the last light and would not return.' },
  { es: 'Guarda {d} que el sol olvidó.', en: 'It keeps {d} the sun forgot.' },
  { es: 'Nadie lo nombra dos veces.', en: 'No one names it twice.' },
  { es: 'El anillo negro le dio voz; {d}, hambre.', en: 'The black ring gave it a voice; {d}, hunger.' },
  { es: 'Bajo la Sima, cada sombra tiene dueño.', en: 'Below the Chasm, every shadow has an owner.' },
  { es: 'Contó {d} hasta que el cielo se cerró.', en: 'It counted {d} until the sky closed.' },
  { es: 'Lo que la luz no alcanza, lo hereda.', en: 'What the light cannot reach, it inherits.' },
  { es: 'Espera como esperan {d}.', en: 'It waits as {d} wait.' },
  { es: 'Un eco del primer eclipse, aún con hambre.', en: 'An echo of the first eclipse, still hungry.' },
  { es: 'Cuando el anillo late, despierta.', en: 'When the ring beats, it wakes.' },
  { es: 'Su nombre se borró; su sombra, no.', en: 'Its name was erased; its shadow was not.' },
];

/** The type theme: the title card's colour and its glow, and the herald's shots. */
export const TYPE_COLOURS: Readonly<Record<PokemonType, { colour: string; glow: string }>> = {
  normal: { colour: '#e8e2d0', glow: '#9a917a' },
  ghost: { colour: '#c49cff', glow: '#6a3fb0' },
  fairy: { colour: '#ffb3e0', glow: '#b04f8c' },
  dark: { colour: '#ff6a7a', glow: '#7a1a2a' },
  poison: { colour: '#d58cff', glow: '#7a2aa0' },
  steel: { colour: '#c8d8e8', glow: '#5a6a7a' },
  fire: { colour: '#ffb060', glow: '#c0401a' },
  ground: { colour: '#e8c080', glow: '#8a5a20' },
  grass: { colour: '#9ee68f', glow: '#2f7a3a' },
  bug: { colour: '#d6e870', glow: '#6a7a1a' },
  flying: { colour: '#b8d4ff', glow: '#4a6ab0' },
  water: { colour: '#7fd4ff', glow: '#1f5f9a' },
  electric: { colour: '#ffe866', glow: '#b09a1a' },
  fighting: { colour: '#ff9a70', glow: '#a03a1a' },
  rock: { colour: '#d8c8a0', glow: '#6a5a3a' },
};
