# Boss bullet patterns: Touhou families, our coverage, new cards and bullet art

Owner request (2026-11-12): "analizar todos los patrones de jefes de touhou a uno", "hacer más variedad de patrones", "acabar de rediseñar los sprites de los ataques de los jefes".

Read-only research. Legend: **[M]** measured in code (path:line), **[I]** inferred, **[K]** general public knowledge of the Touhou Project games (patterns and mechanics only; no names, art, music or text are taken from them). Every card proposed here is our own design.

---

## 1. Touhou pattern families (catalogue) [K]

Skill tested: **L** = reading lanes/gaps at distance, **µ** = micro-dodge (small precise moves), **P** = positioning/route planning, **M** = memorisation, **R** = reaction to a telegraph.

| # | Family | How it reads | Tests | Difficulty levers |
|---|---|---|---|---|
| F1 | Aimed stream / aimed fan | Shots fired at where the player is now; a fan adds side shots | µ, "streaming" (keep moving sideways, never reverse into the stream) | bullets per fan, spread, fire rate, speed |
| F2 | Static (non-aimed) fan / curtain | Fixed shape regardless of the player; safe spots are fixed | L, M | density, angle offsets between volleys |
| F3 | Rings with gaps | Circles from the boss; read the gap and step into it | L | ring count, bullets per ring, gap width, gap rotation per ring |
| F4 | Spirals (+ counter-spirals) | Arms rotating out of the boss; walk around with the arm gap | L, P | arm count, turn rate, counter-rotating second layer, emission rate |
| F5 | Rotating arms / "flower" | Dense continuous arms that look like solid spokes sweeping the screen | P (circle around the boss) | arm count, angular speed, direction reversal |
| F6 | Walls with a gap / closing walls | Lines from screen edges; one lane is open, it moves between waves | L, P | gap width, gap shift per wave, wall speed, both-sides closing |
| F7 | Lasers with telegraph | Thin warning line, then a solid beam; static, fanned or rotating | R, P | warning time, beam width, rotation speed, count |
| F8 | Reflect / bounce | Shots bounce off the screen edge once (or N times) | P, M (where the rebound lands) | bounce count, speed, launch angle |
| F9 | Delayed / frozen bullets that restart | Shots slow to a stop, hang, then relaunch (often re-aimed or in a new direction) | P, M; the freeze is a free reading moment | hang time, re-aim vs fixed, how many hang at once |
| F10 | Acceleration / deceleration | Shots start slow and speed up (or the reverse), so density shifts over time | µ, L | accel, min/max speed |
| F11 | Curving bullets | Constant angular velocity (not homing): arcs, swirls | L, M | curve rate, alternating curve signs |
| F12 | Bullet-to-bullet transform / split | A big shot bursts into a ring or fan, or one bullet type changes into another | R, P | time to split, children count, child aim |
| F13 | Homing | Slow orbs that bend towards the player for a while | P (lead them, then outrun) | turn rate, steering duration, count |
| F14 | Familiars / options | Small emitters around the boss or at fixed points, each with its own pattern | P (stand where few familiars see you) | familiar count, orbit vs static, fire rate |
| F15 | Density waves (tempo) | The same pattern pulses dense / sparse in waves, with breathing room | L, stamina | wave period, peak density |
| F16 | Screen-wide sweep / positional hazards | The arena burns except safe pockets, or a sweep covers the whole screen | P, R | pocket count/size, warning time |
| F17 | Converging / closing rings | Rings that spawn wide and close in on the player or a centre | L (find the gap before it closes) | radius, closing speed, gap |
| F18 | Survival / timeout card | Boss cannot be hurt; survive N seconds | all; endurance | length, layer count |
| F19 | Last-word style finale | One unique, very dense, often surprising card at the end of the fight | M (it is learned across attempts), µ | everything above, combined |
| F20 | Random but bounded scatter | Seeded random spread inside a cone | µ | count, cone |
| F21 | Sine / swinging arms | Arms that swing back and forth instead of rotating | L, P | amplitude, period |
| F22 | Gravity / falling bullets | Shots thrown up that fall with gravity (arcs) | P | gravity, launch speed |

Design truths from the genre [K]: every card has one readable idea; difficulty tiers raise density/speed but keep the shape; aimed and static layers are combined so standing still never works; the hitbox is much smaller than the bullet art (the bright core is the hitbox).

---

## 2. Our system (map)

### 2.1 Engine and data [M]

| Piece | Where | What it does |
|---|---|---|
| Pattern kinds for card bosses | `src/data/enemies.ts:1400-1434` (`DanmakuPattern`) | `rings`, `spiral`, `lanes` (+ `snake`, `alternate`), `fan` (`aim: each/first`), `walls`, `turrets`, `sweep` (melee arm), `zone` (mark, optional ring) |
| Pattern firing | `src/core/danmaku.ts:189-226` (`firePattern`) | Linear shots only: direction × speed from a point; `crossed()` schedules parts (`:42`) |
| Spell-card framework | `src/data/cards.ts:46-106`, `src/core/cards.ts` | HP segments, timers, declaration, capture, survival, last spell, `layers` on a step (`cards.ts:29-32`) |
| Hosted cards (bosses with their own engine) | `src/data/hosted-cards.ts:25-150` | Sableye, Trevenant, Lanturn, Dhelmise, Salazzle, Nihilego play their own moves inside card segments; `maxShots: 140` (`:25`) |
| Herald grammar (procedural Sima bosses) | `src/data/herald.ts:31-53` | Richer than the hand-authored grammar: `stream` (tracking), `ring`, `spiral` (mirror), **`wave`** (sine arms), `lanes`, **`closing`** (converging ring), **`scatter`**, **`homing`**, **`laser`** (warned lines of fast shots), **`pockets`**, `summon` |
| Herald fairness (analytic + grid sim) | `src/core/herald/fairness.ts:10-34`, cap `:418` | Wind-up floors, ≤2 aimed threats, ≤3 layers, density×speed never both > ×1.3, grid-walk survival from 9 starts |
| Senda bosses (48: shadows + wounds) | `src/data/story/kit.ts:26-41`, `:190-222` | 7 templates (`fan`, `drop`, `bloom`, `rain`, `moon`, `walls`, `blades`) built from the guardians' moves; `MAX_SHOTS` 80/100/120/140 by tier (`:192`) |
| Projectile state | `src/core/state.ts:362-392` | pos, vel, radius, lifetime, `steer` (homing), `pierceRoll`, `returnAtMs` (player boomerang), `wave` |
| Projectile death | `src/core/combat.ts:473` | Shots die on walls and on `cover` blocks (pillars, trees, hull) |
| Homing | `src/core/combat.ts:483` (`steerShot`), `SteerDef` `src/data/enemies.ts:109` | Bend towards nearest player for `ms`, then straight |
| Global cap | `src/data/enemies.ts:445` `ENEMY_SHOT_CAP = 160`; enforced `src/core/brain.ts:49` | Past it new shots are simply not spawned |
| Net | `src/net/protocol.ts:121,247`; `PROTOCOL_VERSION = 5` (`src/net/version.ts:14`) | Host snapshots enemy shots ~10 Hz; per-shot fields encoded (pierce, move id) |

Player numbers [M]: walk 140 px/s, radius 10 (`src/data/tuning.ts:14-15`); roll 110 px over 380 ms, i-frames 30-300 ms (`tuning.ts:26-33`). Herald arena 640×400 (`src/data/herald.ts:140`).

### 2.2 Telegraph and fairness rules (GDD §3 and §9) [M]

- Wind-up ≥ 280 ms, ≥ 400 ms for `pierceRoll` zones, applied last in `effectiveTelegraphMs` (docs/gdd.md §9 rule 1).
- ≤ 2 aimed threats on one player at once; bullets capped; standing still never survives a whole card, nor next to any pillar (GDD §3 "Equidad").
- Same card on a harder tier: density, speed, layers or aim, never density and speed above ×1.3 together.
- "Tu turno" after each move: boss idle, leftover bullets fade in 0.35 s (GDD §9 rule 7).
- Card floor: no card breaks before 35 % of its timer (`src/data/cards.ts:137`).
- Co-op: boss targets one player and switches every 6 s, never mid-telegraph; from n = 3 some bosses add one area card (GDD §8, `src/data/party-tricks.ts`).

### 2.3 Every card boss: cards, timers and caps [M]

| Boss (where) | Engine | Cards (Normal → Hard + survival → Nightmare + last) | Timers | maxShots N/H/NM |
|---|---|---|---|---|
| Aegislash (Crypt guardian) | `aegislash-cards.ts` | walls, fans, swords (ph2), hundred → + crown (16 s) → + judgement, lastword | 40/40/45/45, 45, 40 s | 120 / 150 / 170 (`:182,193,209`) |
| Decidueye (Forest guardian) | `decidueye-cards.ts` | volley, leaves, feathers (ph2), rain → + forest (15 s) → + stitch, moonless | 35/35/40/40, 40, 35 s | 100 / 120 / 140 (`:160,168,182`) |
| Sableye (Crypt mid) | hosted, `core/thief.ts` | glint, gems → + vault (12 s) → + lastword | 30-35 s | 140 |
| Trevenant (Forest mid) | hosted, `core/treant.ts` | roots, spiral, curse → + grove (14 s) → + lastword | 35 s | 140 |
| Lanturn (Caves mid) | hosted, `core/danmaku.ts` | bubbles+surge, lure+surge → + abyss (12 s) → + lastword (deep) | 30-35 s | 140 (own Easy: 90, `enemies.ts:1493`) |
| Dhelmise (Caves guardian) | hosted, `core/danmaku.ts` | undertow, kelp, riptide (ph2), bell → + tide (15 s) → + maelstrom, lastword | 40-45 s | 140 (own Easy: 110, `enemies.ts:1541`) |
| Salazzle (Swamp mid) | hosted, `core/swamp-bosses.ts` | dance, spiral, haze → + court (12 s) → + lastword (escort) | 30-35 s | 140 |
| Nihilego (Swamp guardian) | hosted, `core/swamp-bosses.ts` | tendrils, shards, wormhole (ph2), flood → + rift (15 s) → + downpour, lastword | 40-45 s | 140 |
| Heralds (Sima, per seed) | `core/herald/*` | 1-3 layers per card from the herald grammar | generated | 130 (`generate.ts:317`) |
| Senda bosses ×48 | `data/story/kit.ts` | 3 templates each (wounds 4) → + survival → + last | 35/40, 15, 35 s | 80/100/120/140 |
| Echoes, shrine, challenges | reuse the fights above | `ECHO_CARDS` (`cards.ts:128`), shrine reflections | ×0.8 timers for echoes | as source |

Finding [M]: Aegislash Nightmare `maxShots: 170` is above `ENEMY_SHOT_CAP = 160`, so the global cap decides there. Harmless today (the cap only thins patterns and the proof plays the real engine), but it means the data number lies. Worth aligning when touching those cards.

### 2.4 How bullets are drawn today, and the art redesign state [M]

- Enemy shot drawing: `src/adapters/renderer.ts:1448` (`enemyShot`) tries a hand-drawn look first (`enemyShotLook`, `src/adapters/move-vfx.ts:284`): **Bug, Ghost, Grass, Flying, Steel** moving shots are hand-drawn streaks (`STREAK_TYPES`, `move-vfx.ts:282`); still shots are clouds/puddles, still Grass are roots.
- Everything else falls to `bakedShot` (`renderer.ts:1486-1498`): a pixelfx loop per type from `projectileCue` (`src/adapters/fx/cues.ts:171-183`): fire = fireball, ice = ice lance, psychic = energy disc, **every other type = the same `plasma-shot` tinted by type**. Size = radius × `SHOT_HEIGHT.enemy` 4.5 (`src/adapters/fx/director.ts:21`), raised so art is never smaller than the hitbox (commit 9193541).
- Telegraphs: `src/adapters/danmaku-vfx.ts` (rings, spirals, lanes, sweep, zone, card declaration rings), herald lasers `src/adapters/herald-vfx.ts:60`.
- Redesign status: `odd/tasks/pixelfx-vfx.md` closed T1-T5, with these items **pending** (`:32-36`): enemy Bug/Ghost/Grass/Flying/Steel streak shots, spore clouds and roots keep their hand-drawn looks; mark/weakened marks; player death; herald blink. No other task covers boss bullet sprites. [I] So "finish the redesign" = (a) the five streak types (which are exactly Aegislash's steel/ghost and Decidueye's arrows/leaves, the two guardians), (b) giving the generic `plasma-shot` types (water, electric, poison, rock, dark, fairy, dragon, normal, fighting, ground) their own shapes, (c) a hitbox-honest core.

---

## 3. Matrix: families × bosses

✓ used, · not used, ✗ engine cannot do it yet. (Sources: §2.3 data files and the boss engines' docstrings: `enemies.ts:572-580` Trevenant, `:1131-1136` Sableye, `swamp-enemies.ts:143-206` Salazzle/Nihilego.) [M]

| Family | Aeg | Dec | Sab | Tre | Lan | Dhe | Sal | Nih | Herald | Senda | Engine |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F1 aimed fan/stream | ✓ | ✓ | · | · | · | · | · | · | ✓ | ✓ | ok |
| F2 static fan | ✓ | ✓ | · | · | · | · | · | · | · | ✓ | ok |
| F3 gapped rings | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | ✓ | ✓ | ok |
| F4 spiral (+counter) | ✓ | ✓ | · | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ok |
| F5 dense rotating arms | · | · | · | · | · | · | · | · | · | · | ok as a spiral with tiny `everyMs` [I] |
| F6 walls / lanes with gap | ✓ | ✓ | · | ✓ (roots) | · | ✓ | · | ✓ (tendrils) | ✓ | ✓ | ok |
| F7 lasers | · | · | · | · | · | · | · | · | ✓ | · | heralds only (lines of fast shots); no persistent beam |
| F8 bounce | · | · | · | · | · | · | · | · | · | · | ✗ shots die at walls (`combat.ts:473`) |
| F9 delayed / frozen restart | · | · | · | · | · | · | · | · | · | · | ✗ no hold state; vel 0 draws as a cloud (`move-vfx.ts:285`) |
| F10 accel / decel | · | · | · | · | · | · | · | · | · | · | ✗ constant speed |
| F11 curving (non-homing) | · | · | · | · | · | · | · | · | · | · | ✗ (`steer` only bends towards a player) |
| F12 split / transform | · | · | · | · | · | ~ (riptide ring) | · | ~ (wormhole ring) | · | · | ✗ for shots; zones can emit one ring on impact |
| F13 homing | · | · | · | · | · | · | · | · | ✓ | · | ok (`steer`) |
| F14 familiars | ✓ fixed corners | ✓ clones | · | · | · | · | ✓ escort (summons) | · | ✓ summon | ✓ | fixed points only; ✗ moving/orbiting emitters |
| F15 density waves | ~ | ~ | · | · | · | · | · | · | ~ | ~ | ok by data (alternating steps) |
| F16 screen-wide / pockets | ✓ (hundred) | ✓ (rain) | · | · | ✓ surge (self) | · | ✓ haze | ✓ flood, downpour | ✓ | · | ok |
| F17 converging rings | · | · | · | ✓ curse | · | · | · | · | ✓ closing | · | heralds + Trevenant only |
| F18 survival | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | ok |
| F19 last word | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | ok |
| F20 bounded scatter | · | · | · | · | · | · | · | · | ✓ | · | heralds only |
| F21 sine arms | · | · | · | · | · | · | · | · | ✓ | · | heralds only |
| F22 gravity | · | · | · | · | · | · | · | · | · | · | ✗ |
| Melee sweep / dash (ours) | ✓ | · | ✓ glint | ✓ slam | · | ✓ | ✓ dance | ✓ wormhole | · | ✓ blades | ok |

Reading: the hand-authored grammar covers F1-F6, F14 (static), F16, F18-F19 well. Everything about **bullet motion over time** (F8-F12, F22) is missing in the whole game, and the herald grammar already has F7, F13, F17, F20, F21 that no hand-authored boss can use. [M]

### 3.1 Engine features needed, ordered by impact / cost [I]

| # | Feature | Unlocks | Cost | Touches |
|---|---|---|---|---|
| E1 | **Port the herald primitives** (`wave`, `closing`, `scatter`, `homing`, `laser`) into `DanmakuPattern` so card steps and Senda templates can use them | F7, F13, F17, F20, F21 for every boss | S-M: geometry already in `core/herald/patterns.ts`; add to `firePattern`/`patternParts`, telegraphs in `danmaku-vfx.ts` | core, data, vfx, prove |
| E2 | **Shot kinematics**: `accel` (px/s², clamped to `minSpeed`/`maxSpeed`) and `curveDegPerSec` (constant turn), optional `gravity` vector | F10, F11, F22; with `minSpeed: 0` + later `accel > 0`, a basic F9 | S-M: `core/combat.ts` projectile step (next to `steerShot`), `ProjectileState`, `spawnShot` | core, net (encode fields, bump protocol 5→6), herald fairness sim |
| E3 | **Orbiting emitters**: `turrets` with `orbit: { centre: 'boss' \| 'arena', degPerSec, radius }` | F14 moving familiars | S: `turretPoints` time-dependent (`danmaku.ts:116`) + draw the familiars | core, vfx |
| E4 | **Bounce** off arena bounds only (`bounces: 1`); tiles and cover still kill shots | F8 | S-M: `combat.ts:473` branch for map edges | core, net (bounce count), herald fairness (mirror reflection in `simShots`) |
| E5 | **Hold and relaunch**: `hold: { atMs, forMs, then: 'same' \| 'aim' \| 'outward' }` | full F9 (re-aimed) | M: per-shot timer, re-aim at the boss's current target; new still-shot look (not a cloud) | core, net, vfx, fairness (a hanging shot is a threat in place) |
| E6 | **Split**: `split: { atMs, ring/fan, shot }` spawns children at the shot's position | F12 | M: spawn inside projectile update, children obey `maxShots` | core, net, prove/herald peak count |
| E7 | **Persistent beam** entity (rotating capsule hitbox) | true F5/F7 rotating lasers | L: new hazard type, net, render, prove clearance | everything |

Recommendation: E1 → E2 → E3 → E4 → E5 → E6; skip E7 (E1's shot-line lasers + E3 already give rotating-laser readability at a fraction of the cost).

---

## 4. Proposals: new original cards per boss

Fairness defaults for every card below (on top of §2.2): walk-only survivable (the proof ignores the roll, so the roll stays a bonus), wind-up ≥ 400 ms for anything that asks for a route choice, hanging/frozen shots count as one aimed threat per group, ≤ 1 bounce, split children counted against `maxShots`, aims always at the boss's **current target** (co-op: the other players only see it, never a second aimed layer on them). Co-op scaling stays the existing table (HP ×1.6/2.1/2.6, damage ×1/1/1.1/1.15, GDD §8); new cards add no per-player bullets.

Tier rule (same as today): Normal gets the base card, Hard +density **or** +speed or a static layer, Nightmare an aimed layer; never density and speed both above ×1.3.

### Aegislash, El Rey de las Espadas (Steel/Ghost, Crypt; pillars stop shots)

| Card (ES / EN) | Family | Idea and lore fit | Fairness / co-op | Needs |
|---|---|---|---|---|
| Filo Real «Espadas Suspendidas» / Royal Edge "Hanging Swords" | F9 + F3 | A ring of swords flies out, brakes and hangs in the air pointing at the king's target for 700 ms (the hang is the telegraph), then all launch straight at where the target stood. Swords obey the king's word. | One frozen ring at a time = one aimed threat; pillars are cover; the hang never re-aims after it starts | E2 (decel to 0) + E5 |
| Juramento «Vals de la Hoja Errante» / Oath "Wandering Blade Waltz" (phase 2) | F14 orbit + F2 | Two shield-swords orbit the king at 90 px and fire short static fans outward; the king turns his guard (`guard: 'front'`) with them, so the flank moves. | Orbit ≤ 60°/s (slower than walking around at 140 px/s at that radius) | E3 |
| Edicto «Acero que Devuelve» / Edict "Steel Returns" (Nightmare) | F8 | Slow sword fans that bounce once off the arena edge: the rebound is the second wave. | ≤1 bounce, speed ≤ 110 px/s | E4 |

### Decidueye, El Arquero de la Niebla (Grass/Ghost, Forest; trees stop arrows)

| Card | Family | Idea | Fairness / co-op | Needs |
|---|---|---|---|---|
| Signo Niebla «Flechas que se Curvan» / Mist Sign "Arrows That Bend" | F11 | Clone arrows from the mist edge curve left and right in alternating volleys, like arrows lost in fog. | Curve ≤ 40°/s, constant (readable); one curve sign per volley | E2 |
| Signo Pluma «Plumas Dormidas» / Feather Sign "Sleeping Feathers" (phase 2) | F9 + F4 | A feather spiral decelerates and stops, filling the clearing; after 900 ms all feathers resume outward on their own line. | The stopped field is static: the lanes between arms stay where they were | E2 |
| Signo Hoja «Rayo del Claro» / Leaf Sign "Clearing Sunbeam" (Hard+) | F7 + F3 | Light through the canopy: 3 laser lines fanned, warned 600 ms, turning a little each volley, over leaf rings. | Warning ≥ 400 ms; lines turn ≤ 15° per volley | E1 |

### Sableye, el Ladrón de Gemas (Dark/Ghost, Crypt mid)

| Card | Family | Idea | Fairness / co-op | Needs |
|---|---|---|---|---|
| «Gemas de Rebote» / "Ricochet Gems" | F8 + F3 | Stolen gems thrown in a gapped ring bounce once off the vault walls. | 1 bounce; gap still faces the target first | E4 |
| «Brillo Partido» / "Shattered Glint" | F12 | Big gems glint and burst into 6 shards after 1.2 s; the glint is the warning. | Split ≥ 400 ms after spawn, children slow (≤ 100 px/s) | E6 |

### Trevenant (Ghost/Grass, Forest mid)

| Card | Family | Idea | Fairness / co-op | Needs |
|---|---|---|---|---|
| «Ramas al Viento» / "Branches in the Wind" | F21 | Leaf arms swing back and forth like branches in a storm instead of turning. | Herald `wave` limits (amplitude 18-40°, period ≥ 1 s) | E1 |
| «Corro de Fuegos Fatuos» / "Will-o'-Wisp Ring" | F17 + F13 | A ring of cursed wisps closes on the target with one gap; 2 slow homing wisps follow after. | ≤ 2 homing, steer ≤ 80°/s for ≤ 2.5 s (herald limits) | E1 |

### Lanturn, el Farol del Abismo (Water/Electric, Caves mid)

| Card | Family | Idea | Fairness / co-op | Needs |
|---|---|---|---|---|
| «Faroles a la Deriva» / "Drifting Lanterns" | F14 orbit | Three small lure-lights drift around Lanturn and fire single sparks at the target in turn. | `atOnce: 1`, so ≤ 1 aimed emitter at a time | E3 |
| «Corriente de Retorno» / "Backflow" | F10 | Bubble rings go out, slow down and come back towards Lanturn (negative accel): the gap you used on the way out is where you are hit on the way back unless you move. | Return speed ≤ 90 px/s; gaps rotate between rings | E2 |
| «Relámpago Abisal» / "Abyssal Bolt" (Nightmare) | F7 | Electric lines from the lure, warned 700 ms, two at once, rotating. | Warning ≥ 400 ms | E1 |

### Dhelmise, el Ancla de los Juramentos Hundidos (Ghost/Grass, Caves guardian)

| Card | Family | Idea | Fairness / co-op | Needs |
|---|---|---|---|---|
| «Cadena del Ancla» / "Anchor Chain" | F5 | Two dense spokes of kelp turning slowly around the wreck: the chain you walk around. | Doable **today** as a 2-arm spiral, `everyMs` ~60, turn ~4°/shot [I]; check arm gap > 2× player radius at the outer edge | none |
| «Remolino Inverso» / "Inward Whirlpool" (phase 2) | F17 + F11 | Bubbles appear on a wide ring and curl inwards to the anchor. | Closing ring gap facing target; curve constant | E1 + E2 |

### Salazzle, la Reina de la Ponzoña (Poison/Fire, Swamp mid)

| Card | Family | Idea | Fairness / co-op | Needs |
|---|---|---|---|---|
| «Chispas de Feromona» / "Pheromone Sparks" | F20 + F10 | A bounded scatter of embers that slow down and hang 1.5 s as burning motes, then fade. | Hanging motes are drawn with the still-shot look (not a cloud); scatter is seeded (same on every peer) | E1 + E2 |
| «Flor de Llama» / "Flame Bloom" | F12 | Slow fireballs burst into small gapped rings. | Split ≥ 600 ms after spawn | E6 |

### Nihilego, la que Cayó del Cielo (Rock/Poison, Swamp guardian)

| Card | Family | Idea | Fairness / co-op | Needs |
|---|---|---|---|---|
| «Fractura del Cielo» / "Sky Fracture" (phase 2) | F7 | The rift cracks in straight lines: laser lines warned from the wormhole mouth, a new angle each volley. | Warning ≥ 400 ms | E1 |
| «Lluvia al Revés» / "Rain Falling Upward" | F22 | Neurotoxin drops fall down the arena with gravity, then the Ultra wormhole flips gravity and they fall back up. | Flip telegraphed by the wormhole pulse ≥ 400 ms | E2 (gravity) |
| «Neurotoxina Errante» / "Wandering Neurotoxin" (Nightmare) | F13 | 2 slow jelly orbs that follow the target, over Shards' rings. | Herald homing limits | E1 |

### Heralds of the Eclipse (Sima, procedural)

Add generator primitives so seeds get the new families: `accel`/`curve` on any shot, `hold` rings, `bounce` lanes, `split` orbs, `orbit` turrets. Each needs a closed form in `simShots` (`src/core/herald/fairness.ts:82`) and peak counting in `peakOf` (`:100`) before the generator may roll it. [I]

### Senda bosses (48): new templates

Add three `CardTemplate`s to `src/data/story/kit.ts:26`, each a pair of moves like the existing ones, and give **one** to every boss as an extra card (Hard+ to keep Normal fights the same length, see Decision 2):

| New template | Moves | Needs |
|---|---|---|
| `hang` «Velo Suspendido» / "Suspended Veil" | Ring that freezes and relaunches at the target, then a static fan | E2 + E5 |
| `orbit` «Corte de Satélites» / "Satellite Court" | Orbiting emitters firing single shots in turn, then gapped rings | E3 |
| `beam` «Haz Partido» / "Split Beam" | Turning laser lines, then aimed fans | E1 |

Assignment by the boss's shot types (`shots.a`):

| Line | hang (Ghost/Dark/Poison) | orbit (Psychic/Fairy/Normal/Water) | beam (Electric/Fire/Dragon/Ice/Steel/Ground) |
|---|---|---|---|
| Mimikyu | ditto, polteageist, wound | noctowl, jigglypuff, hatterene | pikachu |
| Cubone | haunter, mandibuzz, dusclops, dusknoir | kangaskhan | bisharp, wound |
| Litwick | drifblim, banette, mismagius, muk, wound | · | · |
| Zorua | gengar, mightyena, spiritomb, wound | kecleon | houndoom |
| Abra | · | munna, drowzee, mr-mime, hypno, musharna, wound | · |
| Piplup | weavile | lanturn, lapras | glalie, mamoswine, froslass, wound |
| Shinx | absol, umbreon | · | ampharos, manectric, electivire, wound |
| Axew | · | · | druddigon, bisharp, garchomp, salamence, dragonite, wound |

[M] Assigned from each boss's `shots.a` in `src/data/story/<line>.ts` (the boss rows near line 26). Litwick and Abra get a single template; that is fine because the line's look stays coherent, but a designer may swap one boss to vary it.

### Integration checklist for any card above (CLAUDE.md rule)

- [ ] Every tier's data (Normal/Hard/Nightmare) and Easy left as is.
- [ ] `registerCards` + i18n es/en: `spell.<boss>.<card>` banner and `boss.stance.<id>` short name.
- [ ] GDD §3 card tables (Aegislash, Decidueye, hosted table, Senda) and boss lore (`src/data/boss-lore.ts`).
- [ ] Echoes (`ECHO_CARDS` phase gating), shrine reflections/challenges, challenge dungeons (they reuse fights), party area cards (`party-tricks.ts`).
- [ ] Net: new projectile fields encoded in `src/net/protocol.ts` and `PROTOCOL_VERSION` bumped once for the whole kinematics batch.
- [ ] Prove: witnesses regenerated, kill margins within target; herald fairness extended before the generator uses a primitive.
- [ ] Telegraph drawing in `danmaku-vfx.ts` for every new pattern kind (guests draw from snapshot fields only).

---

## 5. Bullet sprite redesign

### 5.1 What remains [M]

1. Five hand-drawn streak types (Bug, Ghost, Grass, Flying, Steel): `move-vfx.ts:282`, pending in `odd/tasks/pixelfx-vfx.md:35`. These are the guardians' main bullets.
2. Ten types share one tinted `plasma-shot` (`cues.ts:181`): water, electric, poison, rock, dark, fairy, dragon, normal, fighting, ground. Lanturn's bubbles and Nihilego's shards look like the same orb in another colour. [I]
3. No hitbox cue: art is ≥ the hitbox and glowy (`SHOT_HEIGHT.enemy` 4.5 × radius), so on a phone the player cannot tell where the hurt edge is. [I]
4. New kinematics need new states: a **hanging** shot (today any still shot draws as a cloud/puddle, `move-vfx.ts:285`), a **pre-split** shot (glint), a **laser warning line** and beam for card bosses (heralds already have one, `herald-vfx.ts:60`).

### 5.2 Visual language (proposal) [I]

Rule 1, **hitbox-honest core**: every enemy bullet has a bright, near-white core whose radius equals the hitbox; colour and glow sit outside it and never hurt. The glow may reach 1.6× the hitbox, no more.

Rule 2, **shape by role, colour by type**:

| Size class | Hitbox radius | Use | Shape |
|---|---|---|---|
| S "needle" | 4-5 | fast aimed shots, laser segments, arrows | elongated, points along velocity |
| M "orb" | 6-7 | rings, spirals, curtains | the type's shape below |
| L "big" | 8-10 | slow shots, pre-split shots, homing | the type's shape, pulsing outline |
| Hazard | zone | `pierceRoll` areas | unchanged: white + violet double edge (GDD §9 rule 5) |
| Hanging | any | frozen shots | the type's shape with a ticking ring that closes until relaunch |

| Type | Shape | Notes |
|---|---|---|
| Steel | sword / blade, along velocity | Aegislash |
| Ghost | wisp flame with a tail | |
| Grass | leaf (spins slowly) | |
| Flying | feather / arrow | Decidueye |
| Bug | thread with a knot | |
| Water | hollow bubble ring | Lanturn, Dhelmise |
| Electric | spark diamond | |
| Fire | ember teardrop | |
| Poison | droplet, dark rim | |
| Rock | angular shard | Nihilego |
| Ground | pebble | |
| Ice | crystal | |
| Psychic | disc (already) | |
| Fairy | four-point star | |
| Dragon | scale | |
| Dark | crescent | |
| Normal / Fighting | plain orb / knuckle orb | |

Rule 3, **readability on phones**: on-screen core ≥ 4 px at the smallest supported view (568×320, GDD §3); 1 px dark outline on every bullet so it reads on both bright (swamp, forest) and dark (crypt, caves) floors; heralds tint the glow with their theme colour (`HeraldDef.theme`), not the core.

Rule 4, **performance**: one pre-baked atlas per type × size class (the existing worker bake, `src/adapters/fx/bake.ts`), drawn with one `drawImage` per bullet; 160 bullets is the worst case (`ENEMY_SHOT_CAP`). Measure with the existing boss-card perf scene, which the pixelfx task found reports 0 bullets (`pixelfx-vfx.md`, L4): fix that scene first.

Test: iterate every `PokemonType` × size class so a type without a bullet sprite fails a test (same pattern as the existing fx tests).

---

## 6. Proving new cards survivable

- `npm run prove` (`tools/prove.ts`, `src/sim/prove.ts:28-52`) plays every card of every card boss on Normal/Hard/Nightmare on the **real engine** with a walk-only best-first search (100 ms frames, 8 directions, no roll, no attack) from several starts, and stores witnesses in `reports/proof/witnesses.json`; tests replay them. Senda bosses are proven by `tests/sim/story-prove-<line>.test.ts` and `wound-prove.test.ts` (`kit.ts:16-18`). [M]
- Because it runs the real engine, E2-E6 are covered **automatically** as long as they live in `core/` and are deterministic (seeded scatter, no wall-clock). [I]
- What does need work: the heralds' analytic/grid proof (`fairness.ts`) only knows straight shots and homing; each new kinematic needs a closed form there before the generator may roll it. [M]/[I]
- New per-card checks to add: hanging shots never form a closed cage around any reachable cell for longer than the walk-out time; split children counted in the peak; a bounce never sends a shot back along a lane that is the card's only exit. These can be asserted on the witness replay (peak shots, minimum clearance). [I]
- Flow per new card: data → `npm run prove -- --boss=<id>` → if no witness, widen the gap/slow the shot (never the telegraph below the floor) → commit witnesses → `npx vitest run` replays them.
- Co-op is not proved by the search (solo); rely on the existing rule that only the current target is aimed at and that party size scales HP and damage, not bullets. [M] (GDD §8)

---

## Decisions for the owner

1. **First batch scope.** (a) Only port the herald primitives (E1): lasers, homing, closing rings, sine arms, scatter for every boss; (b) E1 plus bullet motion (E2 accel/curve, E3 orbiting familiars, E4 bounce); (c) everything including hold/relaunch and split (E5, E6). **Recommendation: (b)**; it unlocks most of the missing families with one protocol bump, and E5/E6 can follow.
2. **Where the new cards go.** (a) Hard and Nightmare only (Normal fights keep their length); (b) one new card on Normal too, replacing the weakest existing one per boss; (c) add on every tier. **Recommendation: (b)** for the eight dungeon bosses (Normal players see the variety), (a) for the 48 Senda bosses.
3. **Bullet hitbox convention.** (a) Bright core = hitbox, glow is harmless (genre standard); (b) the whole sprite is the hitbox. **Recommendation: (a)**; it is what makes dense patterns readable on a phone.
4. **Lasers.** (a) Lines of fast shots with a warning, as the heralds do now; (b) a real persistent beam entity (E7). **Recommendation: (a)**; (b) costs a new hazard type across core, net, render and proof for little visible gain.
5. **Bullet art order.** (a) First the five guardian streak types (Steel, Ghost, Grass, Flying, Bug); (b) first the ten types sharing the generic orb; (c) all types in one pass with the atlas. **Recommendation: (c)**; one atlas and one test that iterates every type, so nothing stays half done.
