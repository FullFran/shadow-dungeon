/**
 * How each starter learns its moves in the original games (movepools): the
 * relevant attacking and status moves picked from PokeAPI's learnsets
 * (https://pokeapi.co/api/v2/pokemon/{mimikyu-disguised,zorua,litwick,cubone},
 * every version group, read 2026-10-26). Keys are PokeAPI move names, the
 * same spelling as `MoveId`. `other` is PokeAPI's `train` method. Only this
 * derived table is kept; the raw learnsets (88, 84, 72 and 96 moves) are not.
 *
 * Two moves of the original kits are not in these learnsets and stay as
 * grandfathered moves (data/tutor.ts `GRANDFATHERED`): Mimikyu's Shadow Force
 * and Cubone's Bulk Up.
 */
export type LearnMethod = 'level' | 'tm' | 'tutor' | 'egg' | 'other';

export type StarterId = 'mimikyu' | 'zorua' | 'litwick' | 'cubone';

export const LEARNSETS: Readonly<Record<StarterId, Readonly<Record<string, readonly LearnMethod[]>>>> = {
  mimikyu: {
    'shadow-claw': ['level', 'tm'],
    'shadow-sneak': ['level', 'other'],
    'play-rough': ['level', 'tm'],
    'shadow-ball': ['tm'],
    'swords-dance': ['tm'],
    'dazzling-gleam': ['tm'],
    astonish: ['level'],
    slash: ['level'],
    'x-scissor': ['tm'],
    'leech-life': ['tm'],
    'draining-kiss': ['tm'],
    'night-slash': ['other'],
    'wood-hammer': ['level'],
    'drain-punch': ['tm', 'tutor'],
    'phantom-force': ['tm'],
    'giga-drain': ['tm', 'tutor'],
    thunderbolt: ['tm'],
    'take-down': ['tm'],
    hex: ['tm'],
    'hone-claws': ['level'],
    curse: ['egg', 'tm'],
    'bulk-up': ['tm'],
    'will-o-wisp': ['tm'],
    'burning-jealousy': ['tm', 'tutor'],
    'dark-pulse': ['tm'],
    thunder: ['tm'],
  },
  zorua: {
    'fury-swipes': ['level'],
    'feint-attack': ['level'],
    'night-daze': ['level'],
    'foul-play': ['level', 'tm', 'tutor'],
    'nasty-plot': ['level', 'tm'],
    'dark-pulse': ['egg', 'tm', 'tutor'],
    snarl: ['tm'],
    'sucker-punch': ['egg'],
    'shadow-claw': ['tm'],
    'u-turn': ['tm'],
    'lash-out': ['tm', 'tutor'],
    swift: ['tm'],
    'knock-off': ['level', 'tm', 'tutor'],
    'shadow-ball': ['tm'],
    'sludge-bomb': ['tm'],
    'grass-knot': ['tm'],
    extrasensory: ['egg'],
    'calm-mind': ['tm'],
    'swords-dance': ['tm'],
    'hone-claws': ['level', 'tm'],
    agility: ['level', 'tm'],
    'hyper-voice': ['tm', 'tutor'],
    'burning-jealousy': ['tm', 'tutor'],
  },
  litwick: {
    ember: ['level'],
    astonish: ['level'],
    hex: ['level', 'tm'],
    inferno: ['level'],
    'will-o-wisp': ['level', 'tm'],
    flamethrower: ['tm'],
    'heat-wave': ['egg', 'tm', 'tutor'],
    smog: ['level'],
    'night-shade': ['level', 'tm'],
    'flame-charge': ['tm'],
    'clear-smog': ['egg'],
    'shadow-ball': ['level', 'tm'],
    'fire-blast': ['tm'],
    'energy-ball': ['tm'],
    overheat: ['level', 'tm'],
    'flare-blitz': ['tm'],
    poltergeist: ['tm', 'tutor'],
    'solar-beam': ['tm'],
    psychic: ['tm'],
    'temper-flare': ['tm'],
    'calm-mind': ['tm'],
    curse: ['level', 'tm'],
    'acid-armor': ['egg'],
    minimize: ['level'],
    'fire-spin': ['level', 'tm'],
    'dark-pulse': ['tm', 'tutor'],
    'burning-jealousy': ['tm', 'tutor'],
  },
  cubone: {
    'bone-club': ['level'],
    'bone-rush': ['level'],
    bonemerang: ['level'],
    'stomping-tantrum': ['level', 'tm'],
    earthquake: ['tm'],
    bulldoze: ['tm'],
    'mud-slap': ['level', 'tm', 'tutor'],
    headbutt: ['level', 'tm', 'tutor'],
    'double-kick': ['egg'],
    'low-kick': ['tm', 'tutor'],
    'fire-punch': ['tm', 'tutor'],
    'thunder-punch': ['tm', 'tutor'],
    'knock-off': ['tutor'],
    'double-edge': ['level', 'tm', 'tutor'],
    'iron-head': ['egg', 'tm', 'tutor'],
    'earth-power': ['tm', 'tutor'],
    dig: ['tm'],
    'brick-break': ['tm'],
    'focus-punch': ['tm', 'tutor'],
    'swords-dance': ['egg', 'tm', 'tutor'],
    'focus-energy': ['level', 'tm'],
    'belly-drum': ['egg'],
    'iron-defense': ['tm', 'tutor'],
    'rock-slide': ['egg', 'tm', 'tutor'],
    'ice-beam': ['tm', 'tutor'],
    flamethrower: ['tm', 'tutor'],
    'scorching-sands': ['tutor'],
  },
};

/**
 * The competitive sets each kit's recommended build follows (Smogon analyses,
 * as exported by https://data.pkmn.cc/sets/gen9.json, gen8.json, gen7.json).
 */
export const COMPETITIVE_SOURCES: Readonly<Record<StarterId, readonly string[]>> = {
  mimikyu: [
    'gen9 OU/UU Swords Dance: Swords Dance / Play Rough / Shadow Claw / Shadow Sneak',
    'gen8 Battle Stadium Singles Swords Dance Sweeper: Swords Dance / Play Rough / Shadow Sneak / Phantom Force',
    'gen9 RU Swords Dance: Swords Dance / Shadow Claw / Drain Punch / Play Rough',
  ],
  zorua: [
    'gen7 LC Life Orb: Night Daze / Dark Pulse / Extrasensory / Nasty Plot / Knock Off',
    'gen9 LC Choice Scarf: Knock Off / U-turn / Extrasensory / Sucker Punch',
    'Zoroark gen7 UU Nasty Plot: Nasty Plot / Dark Pulse / Focus Blast / Sludge Bomb',
  ],
  litwick: [
    'Lampent gen9 NFE Calm Mind: Calm Mind / Fire Blast / Shadow Ball / Energy Ball',
    'Chandelure gen9 NU Calm Mind: Calm Mind / Fire Blast | Flamethrower / Shadow Ball / Energy Ball',
  ],
  cubone: [
    'gen7 LC Physical Attacker: Bonemerang / Knock Off / Rock Slide / Fire Punch',
    'Marowak gen8 ZU Swords Dance: Swords Dance / Bonemerang / Earthquake / Knock Off',
  ],
};
