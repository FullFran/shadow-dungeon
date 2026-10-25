import type { SpeciesId } from './species';

/**
 * In-run progression (docs/gdd.md §3 "Progresión dentro de la partida"):
 * experience from defeated enemies and the level curve. Everything resets
 * when the run ends. Values are provisional.
 */
export const PROGRESSION = {
  /** Base experience per defeated enemy, by species (the player species gives none). */
  xpBySpecies: {
    mimikyu: 0,
    zorua: 0,
    litwick: 0,
    cubone: 0,
    poochyena: 10,
    gastly: 12,
    aegislash: 60,
    phantump: 12,
    'pumpkaboo-small': 5,
    'pumpkaboo-super': 22,
    foongus: 11,
    spinarak: 10,
    hoothoot: 12,
    trevenant: 50,
    decidueye: 90,
    // Experimental roster: by threat (HP, telegraph speed, area denial).
    zubat: 7,
    tentacool: 12,
    chinchou: 12,
    corphish: 14,
    clauncher: 14,
    wooper: 15,
    grimer: 16,
    koffing: 13,
    ekans: 13,
    croagunk: 18,
    stunky: 9,
    houndour: 15,
    slugma: 14,
    litleo: 13,
    duskull: 13,
    golett: 22,
    pawniard: 7,
    sableye: 50,
    'eclipse-nest': 12,
    'eclipse-hunter': 0,
  } as Record<SpeciesId, number>,
  /** Experience grows with depth: base * (1 + perDepth * (floor - 1)). */
  xpPerDepth: 0.5,
  /**
   * Total experience needed to reach each level: index 0 is level 1 (the run
   * start), the last entry is the level cap.
   */
  levelXp: [0, 25, 60, 110, 175, 255, 350, 460, 585, 725] as readonly number[],
  /** Max HP gained per level above 1 (healed at once on level-up). */
  hpPerLevel: 8,
  /** Damage multiplier gained per level above 1 (additive: level 5 hits 1.2 times as hard). */
  damagePerLevel: 0.05,
} as const;
