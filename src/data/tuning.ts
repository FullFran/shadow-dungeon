/**
 * Every gameplay tunable of the simulation in one place. Values are
 * provisional starting points (docs/gdd.md marks them as such) meant to be
 * adjusted by playing. Distances are in world pixels, times in milliseconds.
 */
export const TUNING = {
  /** Fixed simulation rate. */
  ticksPerSecond: 60,
  /** Upper bound of simulation steps per rendered frame (avoids the spiral of death). */
  maxStepsPerFrame: 5,

  player: {
    maxHp: 100,
    moveSpeed: 140,
    radius: 10,
  },

  stamina: {
    max: 100,
    /** Points per second once the regen delay has elapsed. */
    regenPerSecond: 55,
    /** Pause after any stamina spend before regen starts. */
    regenDelayMs: 450,
  },

  roll: {
    staminaCost: 25,
    durationMs: 380,
    /** Distance covered by a full roll. */
    distance: 110,
    /** Invulnerability window inside the roll, measured from roll start. */
    iframesStartMs: 30,
    iframesEndMs: 300,
  },

  perfectDodge: {
    /** A hit absorbed within this many ms of the i-frames starting is a perfect dodge. */
    windowMs: 120,
    /** Time scale applied to enemies and their projectiles during slow-mo. */
    slowMoScale: 0.3,
    slowMoDurationMs: 500,
    /** Damage multiplier of the next player hit, and how long it waits to be used. */
    damageMultiplier: 1.5,
    buffDurationMs: 3000,
  },

  combat: {
    /** Damage = power * damagePerPower * STAB * effectiveness * multipliers. */
    damagePerPower: 0.2,
    stab: 1.5,
    /** Type immunities (x0) are softened to this multiplier. */
    immunityMultiplier: 0.25,
    /** Walking speed factor while holding a heavy move to charge; other move phases root the player. */
    chargingMoveFactor: 0.4,
    /** Fraction of the remaining knockback applied per 60 Hz tick (ease-out). */
    knockbackPerTick: 0.25,
  },

  /** Starter passives (data/species.ts `passive`). */
  passives: {
    /** Illusion: a sleeping enemy closer than its radius + the player's + this margin is touched and wakes. */
    illusionTouchMargin: 6,
    /** Flash Fire: share of an absorbed Fire hit's damage that heals, and the next heavy move's damage multiplier. */
    flashFireHeal: 0.25,
    flashFireBoost: 1.5,
    /** Flash Fire: Litwick's own Fire hits that stoke the flame (power up the next heavy move), for floors without Fire enemies. */
    flashFireKindle: 4,
    /** Battle Armor: damage multiplier of frontal hits while charging or winding up a heavy move. */
    battleArmorFactor: 0.5,
  },

  lockOn: {
    /** Max player-to-target distance to acquire or keep a lock. */
    range: 340,
    /** Accumulated |wheel deltaY| needed to switch target once (one mouse notch is ~100). */
    wheelThreshold: 90,
    /** Slack around an enemy's body radius for click-to-lock and the hover marker. */
    clickMargin: 6,
  },
} as const;
