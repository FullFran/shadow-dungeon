# Enemy variety per biome and difficulty

Research note (2026-11-12), not a design decision. Owner request (verbatim): "analizar como poner más pokemons enemigos que hagan más variedad de ataques los enemigos y demás. (que hacemos? que sean aleatorios de un pool y metemos mas al pools que tengan sentido con el bioma y la dificultad?"

Legend: **[M]** measured (code read or script run against `origin/main` 5c76039), **[I]** inferred or proposed.

## TL;DR

- **[M]** We already have "random from a pool per biome": every dungeon has a depth-weighted pool, and each room spends a **threat budget** on **roles** from it. The model is fine. The problem is content and two gaps in the model.
- **[M]** 54 floor species (34 base + 20 evolved) share **13 behaviour kinds**, but **lunger** (wind-up + lunge) is 16 of them. In the Crypt only lunger and caster exist until floor 4; in the Forest lungers are 45-63 % of the draw weight on every floor.
- **[M]** The `support` role exists with a cost (4) but **no species plays it**.
- **[M]** **Difficulty never changes who you meet**, only how they fight (tier-gated patterns, HP/damage, roles per room, elite chance). Pools are by depth only.
- **[M]** **Sima strata are cosmetic**: palette and lore change every 10 floors, but the pool is one flat list; floor 25 ("caves" stratum) is 20 % caves species. The abyss (41+) has no species of its own.
- **[I]** Recommendation: keep the weighted-pool + budget model; add (1) per-stratum Sima pools, (2) an optional `minDifficulty` per pool entry, (3) a rare-spawn flag, and (4) **6 new behaviour archetypes** carried by ~5 new species per biome (25 total, all with SpriteCollab Walk/Attack/Hurt). Ship biome by biome.

## 1. Audit today

### 1.1 Behaviour kinds (engine) [M]

Dispatch: `src/core/enemies.ts:412-425` (lunger, caster, slammer, spore, bosses) and `src/core/roster.ts:127-143` (beam, pulse, cone, mortar, bomber, counter); swamp kinds in `src/core/swamp-brains.ts`.

| Kind | Read for the player | Regular species (evolved in italics) |
|---|---|---|
| lunger | wind-up, lunge down a lane, punish window | Poochyena, Pawniard, Phantump, Pumpkaboo S, Hoothoot, Impidimp, Zubat, Ekans, Krabby, *Mightyena, Bisharp, Morgrem, Noctowl, Golbat, Kingler, Arbok* (16) |
| caster | keeps distance, aimed shot / fan / ring / burst | Gastly, Duskull, Spinarak, Drifloon, Remoraid, Litleo, *Haunter, Gengar, Dusclops, Drifblim, Ariados, Octillery* (12) |
| slammer | slow tank, area slam (leap, puddle, trail, ring) | Golett, Pumpkaboo XL, Shroomish, Tentacool, Wooper, Grimer, *Breloom, Muk* (8) |
| spore | static, cloud when close | Foongus (1) |
| beam | lane jet + frontal shell | Corphish, Clauncher, *Crawdaunt* (3) |
| pulse | expanding ring from body | Chinchou (1) |
| cone | frontal breath, lingering cloud | Houndour, Stunky, *Houndoom, Skuntank* (4) |
| mortar | lob at your spot, lingering pool | Slugma, Shellos (2) |
| bomber | gas clouds, explodes when low | Koffing, *Weezing* (2) |
| counter | stance that punishes hits | Croagunk, *Toxicroak* (2) |
| roller / dasher / sniper | curl-roll lane / pass-through dash / locked ink line | Venipede / Salandit / Skrelp (1 each) |

The variants inside lunger are real (feint, weave, scuttle, locked aim, follow-up cuts: `src/data/enemies.ts:50-106`), but they all read as "dodge the lunge". Evolutions escalate the same machine (`src/data/evolved-enemies.ts:4-13`), so they add pressure, not new reads.

### 1.2 Per dungeon (draw weight share by kind, generated floors) [M]

Script over `DUNGEONS` pools with `weightAt` (`src/core/dungeon.ts:74`). It is the pool's weight share before the budget filter, packs and escorts, so it approximates what you meet.

| Dungeon | Pool (path) | Floor 1 | Mid | Last generated | Kinds seen |
|---|---|---|---|---|---|
| Crypt (5 floors) | `src/data/dungeon.ts:81-94` | 2 species: lunger 60 / caster 40 | F2: same 2 kinds | F5: lunger 47 / caster 41 / slammer 12 | **3** |
| Misty Forest (8) | `src/data/dungeons.ts:209-224` | lunger 63 / caster, spore, slammer 13 each | F3: lunger 54 | F7: lunger 45 / caster 28 / slammer 21 / spore 7 | 4 |
| Flooded Caves (10) | `src/data/dungeons.ts:292-306` | lunger 71 | F4: lunger 29 + 5 kinds | F9: lunger 30 / beam 22 / caster 19 ... | 6 |
| Toxic Swamp (10) | `src/data/dungeons.ts:374-389` | 5 kinds, roller 33 | F4: 8 kinds, max 15 % | F9: 8 kinds, max 19 % | **8** |
| Sima (endless) | `src/data/endless.ts:29-99` | lunger 70 | F25: lunger 26 / caster 23 / slammer 18 + 10 kinds | 51 species from F38, no growth after | 13 |
| Senda roads / challenges | `src/data/dungeons.ts:636-645` | 4-6 species from the biomes above | floor-3 weights hold deeper | one evolved form on floor 3 | 2-4 |

Where players see the same thing too often [M+I]:

- **Crypt floors 1-2**: Poochyena and Gastly only on floor 1 (it is also every new player's first dungeon after the tutorial, which uses the same two: `src/data/dungeons.ts:458-461`).
- **Forest**: Phantump, Pumpkaboo S packs, Hoothoot, Impidimp, and later Noctowl/Morgrem are all lungers.
- **Caves floor 1**: Krabby + Zubat packs = 71 % lunger.
- **Senda pools** reuse Gastly (5 of 8), Drifloon/Zubat/Golett (3 each); Mimikyu's and Zorua's are 4 casters/lungers of the Crypt-Forest set.
- **Sima**: Poochyena still weighs 25 % of its base weight at depth 60 (`depthWeight` floor, `src/core/endless.ts:40-41`) and strata do not change the cast.

### 1.3 Roles and threat [M]

- Costs: brute 3, skirmisher 2, ranged 3, swarm 1, controller 4, support 4 (`src/data/encounters.ts:28-35`). Evolutions: role + 1, max 5 (`:123-144`).
- Roles per species: `src/data/encounters.ts:52-113`. `support` has none (`:20-21`); the leader's rally cry stands in for it (`:228-244`).
- `EXPERIMENTAL_ENEMIES` (`src/data/enemies.ts:1109-1125`) says "no other dungeon draws from it yet": stale, Caves and Swamp now do.

## 2. How spawning works now [M]

1. **Pool by depth.** `SpawnEntry { species, weights[floor], pack?, escort? }` (`src/data/dungeon.ts:43-50`). Last weight holds deeper (`src/core/dungeon.ts:74`). Arenas keep their slot in the table.
2. **Tier.** `tieredSpawns` sets `maxRoles` from `ROLES_PER_ROOM` (easy/normal 2, hard/nightmare 3) and adds `extraPerRoom` (0 on every tier) (`src/core/difficulty.ts:20-24`, `src/data/encounters.ts:176`, `src/data/difficulty.ts:80-84`).
3. **Room budget.** `base + perDepth*(floor-1) + jitter` (`src/core/dungeon.ts:229`); chance `rest` of an empty room. It buys entries (pack + escort as one buy, `:232-238`) until nothing fits, at most `maxEnemies` (3) bodies and `maxRoles` roles; a role already bought weighs `repeatWeight` 0.4 (`:247-281`). Front line near the door, back line far (`:283-295`).
4. **Sima.** Pool = `ENDLESS_POOL` entries with `minDepth <= floor`, weight `weight + perDepth*(floor-minDepth)` clamped to [0.25x, 4x] (`src/core/endless.ts:40-49`). Then **squads** replace a room's draw with a fixed mix (`src/data/sima.ts:109-124`, `src/core/sima.ts:77`).
5. **Leaders.** Per room with 2+ enemies, chance rising with depth; the highest threat is crowned: +60 % HP, rally cry heals and re-arms followers, break rule on death (`src/core/leaders.ts:29-43`, `src/data/encounters.ts:203-244`).
6. **Elites.** Seeded per spawn: tiers 0/10/20/30 % with traits `tough`, `frenzied` only (`src/data/difficulty.ts:80-84,174`); the Sima adds depth elites with all six traits, +35 % HP, positional hits from floor 21 (`src/data/sima.ts:89-97`, `src/core/sima.ts:67-74`).
7. **Gates and events.** Seal/key gates mark a leader or elite (`src/data/encounters.ts:248-272`). Nest, ambush, monster house and waves draw from the same pool (`src/core/floor-spawns.ts:36-38`).
8. **Heralds.** Generated Sima bosses at 22, 32, 42... (`src/data/endless.ts:179-180`).
9. **Depth/co-op scaling.** Sima HP +5 %/floor (max 3x), damage +3.5 % (max 2.5x) (`src/data/endless.ts:186`). Co-op: regular enemies x1.25/1.4/1.55 HP for 2/3/4 players, **count unchanged** (`src/data/party-scaling.ts:24-29`).

Order: `generatedFloor` = tiered pool → budget rooms → squads → leaders (`src/core/floor-spawns.ts:20-27`); elites drawn on spawn.

## 3. Is "random from a pool per biome + more species" the right model?

Short answer **[I]**: yes, and we already have it; adding species to the pools is necessary but not enough. A new species that is another lunger adds a name, not variety.

| Model | What it buys | Cost | Verdict |
|---|---|---|---|
| A. Flat random pool per biome | Simple | Same mix on floor 1 and 9 | Already beyond it |
| B. **Weighted by depth + role budget** (today) | Readable combos, ramp | Variety capped by roster | **Keep as the base** |
| C. Difficulty-gated entries (`minDifficulty`) | Hard/Nightmare meet 1-2 extra species: "tougher, not more" holds | 1 optional field, 1 filter in `tieredSpawns`, a test | **Add** |
| D. Rare spawns (low weight + a cue) | Surprise, something to talk about | Flag + one sound/visual; seed-deterministic so co-op agrees | **Add**, 1 per biome |
| E. Themed rooms (e.g. "spider nest", "flooded hall") | Strong identity per room | New room templates in the generator | Later; events already cover nest/monster house |
| F. Mini-boss rooms (a lone evolved + guard) | Peak inside a floor | Overlaps gates (seal marks a leader/elite) and Sima squads | Use the seal gate + squads instead |
| G. Difficulty-only variants (a species changes pattern by tier) | Same art, new read | Already the TierGate system | Keep using |
| H. More affixes (elites) | Cheap variety | Only stats/pace today; more traits blur reads | Open the 4 Sima traits to Hard/Nightmare at most |
| I. **Per-stratum Sima pools** | Strata feel like their biome; abyss gets its own cast | Pool entries gain an optional `bands` list | **Add** |

Why not just more species? Variety is behaviour per room, and the budget buys at most 2-3 roles. With 16 lungers, a room with two skirmishers is almost always two lunges. New **archetypes** change what you do (cut a tether, kill the healer first, watch the floor), which is what the request asks for ("más variedad de ataques").

## 4. Proposals

### 4.1 New behaviour archetypes [I]

Engine cost: S = data + a variant of an existing machine; M = new `kind` (state machine, render, sync fields); L = new player-side mechanic.

| Archetype | Read and counter | Engine | Cost | Co-op |
|---|---|---|---|---|
| **Support** (heal / shield / pace aura) | Channels with a glow; any hit cancels; kill it first | New `support` kind; reuse rally heal (`LEADER.rally`) and elite `armored` flag | M | Heal scales by enemy HP, not party; targets allies in radius |
| **Tether** (thread that slows, then pulls) | Thread lands, 600 ms to roll sideways or hit the thread | Player-side pull force; thread as a projectile with an owner | L | Pulls one player; any ally can cut it (hit the thread) |
| **Burrow** (submerge, ripple, erupt) | Ripple moves under you, ring marks the eruption | Untargetable state (Sableye's blink, `core/thief.ts`, as model) | M | Ripple follows the nearest player, re-picked per dive |
| **Boomerang** (shot or body returns) | Dodge twice, second pass from behind | Projectile with out/back path | S | Same for all |
| **Mimic / ambush** (looks like a prop) | Odd prop; wakes adjacent with a short wind-up | Sleep + disguise sprite; wake rule exists (`DUNGEON.wakeRadius`) | S-M | Wakes on any player |
| **Linked pair** (beam between two) | Line between them sweeps; kill one to stop it | Two spawns sharing a state; pair as escort | M | Same for all |
| **Wall-bouncer** | Ricochets twice, path drawn | Roller variant with wall reflection | S | Same |
| **Vision denial** (ink) | Darkened circle around the hit player for 3 s | Overlay on the victim's client only | S-M | Per victim; render-only, no sync of the effect beyond the hit |

### 4.2 Species per biome [I, sprites M]

Sprites: SpriteCollab `tracker.json` read 2026-11-12 (`master`, same source as `tools/fetch-sprites.mjs:37`; nothing downloaded into the repo). All below have **Walk, Attack, Charge, Hurt** and a shiny sheet set; "no Shoot" falls back to Attack (`docs/species-candidates.md`). Shiny is only needed if a species becomes playable. Checked and rejected: **Frillish 0592** (phase 0, no sprites), Sneasel 0215 (Weavile already in the game's sprite list), Absol (already used).

Threat = role cost unless noted. "Hard+" = `minDifficulty: 'hard'` entry (model C).

**Crypt** (ghost/dark/steel, the Sword King's tomb). Today: 3 kinds.

| Dex | Species | Behaviour (original) | Archetype | Role / threat | Floors / gate |
|---|---|---|---|---|---|
| 0679 | Honedge | A loose blade of the king's guard: spins out down a lane and flies back to where it started | Boomerang (body) | skirmisher 2 | F1+ (replaces some Poochyena weight) |
| 0436 | Bronzor | Rings itself: allies in radius gain one-hit armor; hit it during the ring to cancel | Support (shield) | support 4 | F2+ |
| 0562 | Yamask | Rests as a grave mask among the decor; when it wakes, a slow curse ball that slows the hit player's roll recharge | Mimic + caster | ranged 3 | F2+ |
| 0198 | Murkrow | Dives at the player holding the most coins, steals a few, flees to the far side; kill it to drop them | Thief (light) | skirmisher 2 | F4+, normal+ |
| 0707 | Klefki | Keyring jingle: wakes the sleeping enemies of the next room unless killed first; carries the floor key on `key` gates | Alarm (support) | support 3 (override) | F4+, rare (D) |

**Misty Forest** (grass/bug/fairy, fog). Today: lunger-heavy.

| Dex | Species | Behaviour | Archetype | Role / threat | Floors / gate |
|---|---|---|---|---|---|
| 0069 | Bellsprout | Rooted; a long vine sweep over 120°, marked arc, then a slow regrow | Sweep (reuse danmaku `sweep`) | controller 3 (override) | F1+ |
| 0540 | Sewaddle | Silk thread: slows, then pulls 1.5 tiles towards it (or into its packmate) | Tether | ranged 3 | F3+ |
| 0273 | Seedot | Packs of 3 that look like acorns on the floor and pop up when you pass | Mimic swarm | swarm 1, pack 3 | F2+ |
| 0755 | Morelull | Glows: allies in radius get a faster clock; in fog floors its light is the only cue | Support (pace) | support 4 | F5+ |
| 0546 | Cottonee | Cotton gust: a wide push towards hazards, enemies or walls; no damage | Push controller | controller 3 (override) | F3+, hard+ |

**Flooded Caves** (water/rock, pools). Today: lunger 71 % on floor 1.

| Dex | Species | Behaviour | Archetype | Role / threat | Floors / gate |
|---|---|---|---|---|---|
| 0120 | Staryu | Spins and ricochets off two walls, path drawn first | Wall-bouncer | skirmisher 2 | F1+ |
| 0339 | Barboach | Dives into a shallow pool, ripple tracks you, erupts with a ring; on dry rooms it only slams | Burrow | brute 3 | F2+, pool rooms (`water.poolChance` 0.55, `src/data/dungeons.ts:333`) |
| 0318 | Carvanha | Fast packs that only swim inside pools; bite waders | Terrain swarm | swarm 1, pack 3 | F3+ |
| 0116 | Horsea | Ink shot: darkens the hit player's view for 3 s, then bubble fan | Vision denial | ranged 3 | F4+, hard+ |
| 0222 | Corsola | Heals allies in radius (15 % HP) every 6 s; hit cancels the channel | Support (heal) | support 4 | F6+ |
| 0688 | Binacle | Clings to a wall tile; punches out along the wall in both directions | Wall ambush | brute 3 | F5+, rare (D) |

**Toxic Swamp** (poison/dark). Today: the most varied (8 kinds).

| Dex | Species | Behaviour | Archetype | Role / threat | Floors / gate |
|---|---|---|---|---|---|
| 0568 | Trubbish | Drops trash bags that burst into poison after 4 s or when hit | Trap layer | controller 3 (override) | F1+ |
| 0315 | Roselia | Fragrance: heals allies over time and clears their break slow | Support (heal) | support 4 | F3+ |
| 0848 | Toxel | Rhythmic sound rings with one gap, three beats; walk through the gaps | Mini-danmaku rings | controller 4 | F4+ |
| 0316 | Gulpin | Swallows player projectiles in front of it, spits them back after 1 s | Reflector | brute 3 | F5+, hard+ |
| 0336 | Seviper | Tail sweep in a 180° arc behind it, then a coiled lunge forward | Sweep + lunge | skirmisher 2 | F6+ |

**Sima del Eclipse** (abyss, floor 41+, and strata pools)

| Dex | Species | Behaviour | Archetype | Role / threat | Floors / gate |
|---|---|---|---|---|---|
| 0338 + 0337 | Solrock + Lunatone | Always as a pair; a burning line between them that rotates; kill one, the other enrages | Linked pair | controller 4 each (pair = one buy, 8) | F41+ (abyss) |
| 0201 | Unown | Packs of 4 that orbit you, then fire inward at once | Formation swarm | swarm 1, pack 4 | F41+ |
| 0177 | Natu | Blinks next to you, pecks, blinks away | Teleporter | skirmisher 2 | F31+ |
| 0605 | Elgyem | Slow orb; if it hits, you swap places with Elgyem | Position swap | ranged 3 | F45+, hard+ |
| 0561 | Sigilyph | Raises a screen in front of allies that halves the damage they take from the front | Support (barrier) | support 4 | F41+ |

Unown: `0201/0000` is form A only; other letters are separate forms (not checked).

Co-op for all of the above **[I]**: HP scales with `enemyHp` like any regular; counts never change; targeted effects (tether, ink, swap, Murkrow's theft) pick one player and are readable to the rest; supports make focus fire the co-op answer.

### 4.3 Model changes [I]

1. `SpawnEntry.minDifficulty?` filtered in `tieredSpawns` (`src/core/difficulty.ts:20`).
2. `EndlessPoolEntry.bands?: SimaBandId[]` (weight x3 inside its band, x0.5 outside) so strata 1-4 favour their biome and the abyss gets its own cast.
3. `SpawnEntry.rare?: true` with weight about 0.2 and an arrival cue.
4. Sima elites on Hard/Nightmare in the main dungeons: open `swift` and `armored` to `ELITE_TRAITS` (`src/data/difficulty.ts:174`).
5. Challenge/Senda pools: each line gains one new species of its biome (keep the "hit at least neutrally" test, `tests/core/challenge.test.ts`).

## 5. What each addition needs (integration rule)

Per new species:

- [ ] `SpeciesId` + stats (`src/data/species.ts`), XP (`src/data/progression.ts`), role and threat (`src/data/encounters.ts`).
- [ ] Behaviour def in `ENEMY_BEHAVIOUR` (`src/data/enemies.ts:1708`); new kind → dispatch (`src/core/enemies.ts:412` or `src/core/roster.ts:127`), render, sound, `fittingTraits` for elites.
- [ ] Sprites: an entry in `tools/fetch-sprites.mjs` + `src/data/sprite-meta.json` (normal; shiny only if playable).
- [ ] i18n names es/en (`species.<id>`); floor lore lines that mention it if any (`src/data/dungeon-lore.ts`).
- [ ] Pools: its dungeon, `ENDLESS_POOL` (and band), Sima squads where it fits, the Senda/challenge pools of its biome, floor-event pools come for free.
- [ ] Net: any new AI state field (tether target, shield, burrowed, pair link) in the enemy sync (`src/core/sync.ts`); enemies are not saved, so no save/migrate change unless a new seen-list is added.
- [ ] Tests that iterate every pool species: has behaviour, role, sprite, i18n; budget affordability on the Sima's small budget (threat <= 5).
- [ ] GDD §3 (dungeon casts, "Encuentros con sentido"), `npm run prove` / balance sim (XP per floor, clear time).

Suggested order: Crypt first (worst variety, every player sees it), then Forest, Caves, Swamp, Sima abyss. Archetypes in cost order: boomerang, mimic, wall-bouncer, support, burrow, linked pair, tether.

## Decisions for the owner

1. **Model**: keep weighted pools + budget and add difficulty gates and per-stratum Sima pools? (a) yes, both; (b) only add species, no model change; (c) also add themed rooms now. **Recommend (a).**
2. **Difficulty**: should Hard/Nightmare add species? (a) yes, 1-2 per biome via `minDifficulty`; (b) no, difficulty stays patterns and elites only. **Recommend (a).**
3. **Support role**: introduce healers/shielders (Bronzor, Morelull, Corsola, Roselia, Sigilyph)? (a) yes, one per biome; (b) only in the Sima; (c) no, leaders stay the only support. **Recommend (a).**
4. **Scope of the first batch**: (a) Crypt's 5 species + boomerang, mimic and support archetypes; (b) all four biomes with reused machines only (no new kinds); (c) everything in this note. **Recommend (a).**
5. **Player-control effects** (tether pull, ink, position swap): (a) allow, all telegraphed and Hard+ for the harshest; (b) allow only slow/push, no pull or swap. **Recommend (a).**
