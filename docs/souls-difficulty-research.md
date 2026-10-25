# Difficulty by design: Souls, roguelikes and Touhou

Research note for future difficulty-balance passes of Mazmorra Sombría. Written 2026-10-25.

**Scope, after the user's refocus.** The main question is how these games make play harder through *design*: level layout, enemy placement, encounter composition, boss movesets and spell cards. Stat multipliers (NG+, co-op HP, the damage formula) are kept short in Appendix A. The final section ("Propuesta para Mazmorra Sombría") is in Spanish and turns the findings into rules and numbers for our generator, tiers, bosses and a balance-measuring harness.

**Evidence labels.** Every claim carries one of these:

- **[V]**: verified this session against the cited page (wiki with datamined params, official notes, peer-reviewed paper).
- **[C]**: community or critic opinion, or a secondary source that was read but may be imprecise.
- **[U]**: unverified. It comes from general knowledge or a search summary only. Check it before relying on it.
- **[I]**: my inference or design synthesis, not a sourced fact.

Several primary wikis blocked automated fetches this session (Touhou Wiki: HTTP 418/Cloudflare; Hades fandom and wiki.gg: 401/402; web.archive.org unavailable). The gaps are listed in [§8](#8-unverified-items-and-gaps).

---

## 0. Our current model (read from the repo)

| Knob | Where | Current value |
|---|---|---|
| Tier HP / damage | `src/data/difficulty.ts` `TIERS` | easy 1/1, normal 1.15/1.15, hard 1.3/1.3, nightmare 1.45/1.5 |
| Telegraph scale | same | 1 / 0.95 / 0.9 / 0.85, floor `TELEGRAPH_FLOOR = { share: 0.75, minMs: 280 }` |
| Cooldown scale | same | 1 / 0.9 / 0.8 / 0.7 |
| Elite chance | same | 0 / 0.1 / 0.2 / 0.3 (traits: `tough` HP×1.5, `frenzied` cooldown×0.65) |
| Extra enemies per room | same | 0 on every tier (user feedback: more enemies is not fun) |
| Set-piece encounters | same | frequency 1 / 1.2 / 1.5 / 2, extra waves 0/0/0/1 |
| Roll i-frames / stamina | same | i-frames ×1/1/0.9/0.8, stamina ×1/1/1.1/1.2 |
| Restarts per floor | same | ∞ / ∞ / 1 / 0 |
| Coins | same | ×1 / 1.3 / 1.7 / 2.2 |
| Roll | `src/data/tuning.ts` | 380 ms, i-frames 30 to 300 ms, cost 25 of 100 stamina, regen 55/s after 450 ms |
| Damage | `src/core/damage.ts` | `max(1, round(power × 0.2 × STAB(1.5) × typeEff × mult))`, immunity softened to ×0.25. No defense stat. |
| Player levels | `src/data/progression.ts` | 10 levels, +8 max HP and +5 % damage per level (level 10: 172 HP, ×1.45 damage) |
| Poise | `src/data/enemies.ts` `PoiseDef` | per-species `hitstunScale` and `knockbackScale` (0 = never staggered). No poise meter. |
| Endless depth | `src/data/endless.ts` `ENDLESS.scaling` | HP `1 + 0.08 (f−1)` capped at 4; damage `1 + 0.05 (f−1)` capped at 3; echo bosses take 0.6 of that HP |
| Endless spawns | same | `1 + floor(0.34 (f−1))` + jitter ≤ 1, max 5 per room |
| Co-op scaling | `src/core/party.ts`, `src/core/enemies.ts` | **none found**: enemy HP does not depend on party size |
| Boss spell cards | `src/core/danmaku.ts` `danmakuCardAt` | cards cycle in fixed order by `combosDone`, with a phase-2 list. They are not tied to HP segments or timers. |
| Roster budget | `TUNING.roster` | one hit ≤ 35 % of a starter's HP; damaging wind-up ≥ 300 ms |

---

## 1. Souls: difficulty through level and encounter design

### 1.1 Encounter-design principles

- **Hazards share the space with enemies.** Sen's Fortress layers pressure-plate wall traps, snipers, narrow catwalks between swinging blades, a demon pit below, and a rooftop giant who feeds a boulder trap and throws firebombs [V] ([Giant Bomb: Sen's Fortress](https://giantbomb.com/wiki/Locations/Sens_Fortress)). Kotaku calls Sen's a microcosm of the whole game's design [C] ([Kotaku](https://kotaku.com/what-dark-souls-is-really-all-about-5874599)). Lesson: one hazard plus one enemy type in the same room is harder than either alone, and costs no stat change.
- **Aggro range lets the player split a group.** At Sen's entrance the serpent soldiers can be pulled one at a time if the player advances slowly [C] ([Giant Bomb](https://giantbomb.com/wiki/Locations/Sens_Fortress)). A group that *can* be split is a skill check. A group that cannot is a "gank".
- **Pair roles so each covers the other's blind spot, and stagger their attacks so the player must react rather than memorise.** Pushers go near cliffs and projectile users go up high. Ranged plus melee is the simplest pairing [C] ([Critical Points: good enemy placement](https://critpoints.net/2018/02/18/good-enemy-placement/), with Castlevania examples; the author says Dark Souls does the same).
- **High ground and sightlines.** Archers on ledges (Anor Londo's silver-knight archers on the buttress are the best-known case) control the space below [U]. Elevated scouting points let the player read a group before committing [C] (High Wall of Lothric analysis, [Notion](https://lava-freeze-486.notion.site/A-Look-at-the-Level-Design-of-Dark-Souls-III-from-The-High-Wall-of-Lothric-f62599d6591947a7ac7f6827a9160a86), not read in full).
- **Ambushes around corners.** Examples are the Undead Burg ambushes, enemies dropping from ceilings, and mimics as bait chests [U]. They work when the area gives a cue (a corpse, a sound, a too-convenient item) or a retreat path [I].
- **Run-back and shortcut distance is a difficulty knob.** How far the bonfire is from the boss fog, and when a shortcut opens, sets the cost of failure without touching enemy stats [U]/[I]. The roguelite equivalent is the resources a room costs (HP, flasks, time on the clock).
- **Items as bait.** An item on a ledge near a drop, or at the end of a dead end guarded by an ambush, sets up a risk/reward choice [U].

### 1.2 DS2 Scholar of the First Sin: the same map, a different placement

SotFS (2015) is the cleanest case of "harder by rearranging, not by multiplying":

- Heide Knights are placed in Heide's Tower in SotFS. Some attack on sight. The rest turn hostile and roam once the Dragonrider dies, and they lost their guaranteed drop [V] ([Fextralife: Heide Knight](https://darksouls2.wiki.fextralife.com/Heide+Knight)). Old Knights now meet the player right at the Heide entrance from Majula [C] ([Fextralife: Heide enemies](https://darksouls2.wiki.fextralife.com/Enemies-Heide's+Tower+of+Flame)).
- Players reported being ganged on entering the tower after the Dragonrider. Replies say baiting one at a time or a parry shield handles it [C] ([Steam thread](https://steamcommunity.com/app/335300/discussions/0/343788552553803186)).
- Critics summarise SotFS as swapping some chokepoints for ambushes. It was arguably fairer, but some rooms read as gank squads [C] (low-quality source: [cyberpost](https://cyberpost.co/?p=6079)).
- DS2 NG+ adds red-phantom NPC invaders and extra items in fixed places. Elden Ring NG+ changes stats only, not placements [U] (not fetched; see Appendix A for ER's stat changes).

Lesson [I]: a harder tier can reuse every room and enemy we already have, but place them differently: a ranged enemy on the far side of a pit, a roamer that activates after an event, an ambush near the reward.

### 1.3 Boss design: what reads as fair and what does not

- **Duo bosses: Ornstein & Smough.** Their attacks overlap, and Ornstein starts attacking before the player is fully in the arena. Some players call it unfair overlap [C] ([Steam](https://steamcommunity.com/app/570940/discussions/0/3883851232917130869)). Retrospectives call it "brutal but fair", a test of spacing and patience [C] ([TechRadar](https://www.techradar.com/news/dark-souls-10th-anniversary-celebrating-the-best-dark-souls-bosses)). The survivor absorbs the fallen one's power, so the player chooses which phase 2 to face [C]. Lesson [I]: a second threat must be parseable as pressure from one direction, not a dodge that is cancelled every time.
- **Malenia (Elden Ring).** Official patch 1.04 lists only a fix where her HP did not heal correctly in online multiplayer, and no Waterfowl Dance change [V] ([Bandai Namco: 1.04 notes](https://en.bandainamcoent.eu/elden-ring/news/elden-ring-update-notes-104)). Press reported an accidental buff in 1.04 (healing on missed hits) reverted in 1.04.1 on 27 April 2022 [C] ([Stevivor](https://stevivor.com/news/elden-ring-hotfix-nerfs-malenia-after-accidental-buff/), [mp1st](https://mp1st.com/news/elden-ring-update-1-004-001-brings-fixes-to-malenia-more-this-april-27)). The common criticism of Waterfowl Dance is that it has a very short tell relative to its reach and punishes the default (rolling) response [U]. Lesson [I]: a move whose correct answer contradicts the trained answer needs a longer, distinct tell.
- **Delayed attacks and input reading (Elden Ring).** Long hold-then-release swings punish panic rolling. Some attacks visibly respond to the player's heal or attack input. Players accept the first as learnable and resent the second as "cheating" [U]. Lesson [I]: delays must be *consistent per move* so they can be learned. Never trigger an attack off the player's button press.
- **Phase 2 adds moves, not only numbers.** Gael's and Midir's later phases add new patterns and arena-wide attacks. This is widely praised [U]. Nightreign's official description of Deep of Night also escalates through composition and information, not only stats (§1.4).
- **Arena and camera.** Bed of Chaos (pits and a one-mistake fall) and fights where the camera loses a large boss are the standard "unfair" examples [U]. Lesson [I]: the arena may be the threat, but its rules must be visible before the first death.

### 1.4 Elden Ring Nightreign: Deep of Night

- Enemy strength escalates with Depth. Stronger red-sheen variants appear. At higher Depths some map points of interest are hidden, and the target Nightlord is unknown until the final battle [V] ([Bandai Namco: Deep of Night explained](https://en.bandainamcoent.eu/elden-ring/news/elden-ring-nightreign-the-deep-of-night-explained)).
- Per the wiki: Depth 2+ may field the Everdark Sovereign version of the Nightlord. Depth 3+ may conceal map POIs and the Nightlord until the final day. Defeat penalties are −0 at Depth 2, then −200/−400/−600 at Depths 3/4/5 [V] ([eldenring.wiki.gg: Deep of Night](https://eldenring.wiki.gg/wiki/Nightreign:Deep_of_Night)).
- Patch 1.02.3 (24 September 2025) lets players lower their Depth by one and adds demotion protection at Depths 3 to 5 [V] ([Bandai Namco patch 1.02.3](https://www.bandainamcoent.com/news/elden-ring-nightreign-patch-notes-version-1-02-3)).
- **No public datamine of per-Depth stat values was found.** One secondary source says only HP and damage are buffed and poise is not [C] ([Deltia](https://deltiasgaming.com/?p=344294)). Pre-launch datamine reports (five Depths, "magmafied" bosses, three extra relic slots) are unconfirmed [C] ([AOL](https://www.aol.com/elden-ring-nightreign-dataminers-theyve-215512894.html), [Gosugamers](https://www.gosugamers.net/entertainment/news/77089-elden-ring-nightreign-introduces-high-difficulty-expedition-mode-deep-of-night)).

Lesson [I]: Nightreign's top difficulty is mostly *variants, hidden information and a meaner boss version*, plus a ladder with loss protection.

---

## 2. Roguelikes: composition, behaviour and stacked modifiers

### 2.1 The Binding of Isaac (Rebirth/Repentance)

- **Rooms are hand-made layouts with occurrence weights.** Normal rooms have a weight, and rare rooms usually hold more pickups. Shapes are 1×1, 2×1, 2×2, L, narrow and tiny. The boss room spawns as far as possible from the start [V] ([Isaac wiki: Rooms](https://bindingofisaacrebirth.wiki.gg/wiki/Rooms)). Room files also carry a difficulty value used per stage [U] (not on that page).
- **Champions are design, not only stats.** Chance is 5 % on Normal, 20 % on Hard and 75 % in The Void. Champion Belt adds +15 points and each Purple Heart doubles the chance [V] ([Isaac wiki: Champions](https://bindingofisaacrebirth.wiki.gg/wiki/Champions)). Most champions get about 2× HP and full-heart contact damage. Many change *what the player must do* [V]:
  - Dark Red becomes a flesh pile that regenerates unless finished.
  - Pulsing Green splits in two on death.
  - White is invincible until the other enemies die (a kill-order puzzle).
  - Pulsing Red makes other enemies regenerate 20 HP/s while it lives (kill it first).
  - Translucent fires spectral shots through obstacles (cover no longer works).
  - Dark Cyan explodes on death, Orange steals coins, Purple pulls Isaac and shots inward.
  - Crown (×6 HP) turns nearby non-champions yellow.
- Champions drop a coloured pickup on Normal. Hard cuts the drop rate to 33 % and Greed gives none [V] (same page).
- Not retrieved: curses, boss HP per stage, Greed mode waves.

### 2.2 Enter the Gungeon

- **Every room was designed and playtested by hand, and procedural generation assembles them** [V] ([Wikipedia](https://en.wikipedia.org/wiki/Enter_the_Gungeon)). Flipping a table deletes enemy bullets in a small radius. Lead designer Dave Crooks discussed difficulty in a Q&A [C] ([Game Developer Q&A](https://www.gamedeveloper.com/design/q-a-the-guns-and-dungeons-of-i-enter-the-gungeon-i-)). In the original game many projectiles had custom offsets so that visual hits matched real hits. *Exit the Gungeon* shrank player and bullet hitboxes to allow more overlap [C] ([Game Developer: Exit the Gungeon](https://gamasutra.com/design/building-i-enter-the-gungeon-i-s-dungeon-climbing-spin-off-i-exit-the-gungeon-i-)).
- **Curse → Jammed** [V] ([ETG wiki: Curse](https://enterthegungeon.wiki.gg/wiki/Curse)):

  | Curse | 0 | 1–2 | 3–4 | 5–6 | 7–8 | 9 | 10+ |
  |---|---|---|---|---|---|---|---|
  | Jammed enemy % | 0 | 1 | 2 | 5 | 10 | 25 | 50 |
  | Jammed boss % | 0 | 0 | 0 | 0 | 20 | 30 | 50 |

  A Jammed enemy deals a full heart, moves and shoots 50 % faster, has −33 % cooldowns, gains contact damage, and has HP `3.5 × hp + 10` (capped). A Jammed boss deals a full heart per attack and has HP `1.2 × hp + 100`. At curse 10 the unkillable **Lord of the Jammed** spawns and chases the player. Room-reward chance is `(1 + coolness − curse) %`. At curse 20+ every chest has a fuse, at 47+ all chests are mimics, and at 100+ there are no room-clear rewards [V].
- **Boss DPS cap per floor** (A Farewell to Arms/Classic): 30/25, 42/35, 60/50, 70/58, 78/65, 80/70. It is applied over a 3 s window, a single shot is limited to 3× the cap, co-op raises it by 70 %, and Boss Rush has no cap [V] ([ETG wiki: Boss](https://enterthegungeon.wiki.gg/wiki/Boss)). This bounds fight length against build power, so every pattern gets seen.

### 2.3 Hades: Pact of Punishment (Heat)

Primary pages blocked; values from secondary guides [C] ([Prima](https://primagames.com/gaming/hades-guide-pact-of-punishment-modifiers-heat), [TrueAchievements](https://www.trueachievements.com/game/Hades/walkthrough/7)) and memory [U]:

| Condition | Effect per rank | Kind |
|---|---|---|
| Hard Labor | +20 % enemy damage, 5 ranks | stat |
| Lasting Consequences | −25 % healing, 4 ranks | resource |
| Convenience Fee | +40 % shop prices, 2 ranks | economy |
| Jury Summons | +20 % enemies per encounter, 3 ranks | count |
| Extreme Measures | bosses gain new techniques and phases, region by region (Furies, Hydra, Theseus & Asterius, Hades) | **behaviour** |
| Calisthenics Program | +15 % enemy HP, 2 ranks | stat |
| Benefits Package | armored foes gain perks [U] | **behaviour** |
| Middle Management | an extra foe in miniboss encounters [U] | composition |
| Underworld Customs | one boon purged per region | resource |
| Forced Overtime | +20 % enemy speed [C] | tempo |
| Heightened Security | +400 % trap and magma damage [C] | hazard |
| Routine Inspection | disables Mirror talents [C] | meta |
| Damage Control, Approval Process, Tight Deadline, Personal Liability | shields on foes, fewer boon choices, a region timer, and losing hit protection [U] | mixed |

The design point that matters [I]: each condition is **one named, legible axis with ranks**. About half of them change behaviour, composition, economy or time rather than HP and damage, and the reward (bounties) scales with total Heat.

### 2.4 Dead Cells: Boss Stem Cells

From [Dead Cells wiki: Boss Stem Cell](https://deadcells.wiki.gg/wiki/Boss_Stem_Cell) [V]:

| BSC | Safety nets removed | Content added | Reward |
|---|---|---|---|
| 1 | fountains only at every other passage | early boss phases change, new doors | forge cap ++ to 100 % |
| 2 | no fountains, one flask charge per passage | — | cell drops ×2 |
| 3 | 3 flask charges in the whole run | Scroll Fragments | item levels +1, cells ×2 |
| 4 | no flasks | **mob detection range up, most mobs teleport to you** | item levels +3, cells ×3 |
| 5 | as BSC 4 | Malaise, Astrolab stage | — |

Higher BSC also raises enemy tier, density and variety, but no per-level numbers are listed [V]. The pattern [I]: remove safety nets step by step, add behaviour at the top, and pay proportionally.

### 2.5 Slay the Spire: Ascension (stacked, cumulative)

From [StS wiki: Ascension](https://slaythespire.wiki.gg/wiki/Ascension) [V]. A1: more elites. A2/A3/A4: normal enemies, elites and bosses deal more damage. A5: heal 75 % after a boss. A6: start damaged. A7/A8/A9: more HP. A10: a curse card. A11: one fewer potion slot. A12: fewer upgraded cards. A13: less boss gold. A14: lower max HP. A15: worse events. A16: pricier shops. **A17/A18/A19: harder movesets for normals, elites and bosses.** A20: double boss. The top rungs are behaviour, and each rung is opt-in and one axis.

### 2.6 Risk of Rain 2: time coefficient and the director

From [RoR2 wiki: Difficulty](https://riskofrain2.wiki.gg/wiki/Difficulty) and [Directors](https://riskofrain2.wiki.gg/wiki/Directors) [V]:

```
playerFactor = 1 + 0.3 (players − 1)
timeFactor   = 0.0506 × difficultyValue × players^0.2      (Drizzle 1, Rainstorm 2, Monsoon 3)
stageFactor  = 1.15^stagesCompleted
coeff        = (playerFactor + minutes × timeFactor) × stageFactor
enemyLevel   = 1 + (coeff − playerFactor) / 0.33
credits/s    = creditMultiplier × (1 + 0.4 coeff) × (players + 1) / 2
```

The director buys "cards" (monster types) with credits. Elite tier 1 costs ×6 (HP ×4, damage ×2) and tier 2 costs ×36 (stage 6+). It picks the highest affordable tier, and the whole wave shares one affix. It rejects monsters that are "too cheap" relative to its credits, so late waves are fewer and stronger, not swarms. Caps: at most 5 per card per wave and 40 on the map [V]. The lesson is a *budget spent on composition*, with co-op scaling sub-linearly.

### 2.7 Spelunky

The level is a 4×4 grid of rooms with a guaranteed solution path drawn first: a random walk (1–2 left, 3–4 right, 5 down). Rooms on the path are typed by their required exits, and off-path rooms are free [V] ([Darius Kazemi, Spelunky generator](https://tinysubversions.com/spelunkyGen/)). Each room type has hand-made templates with probabilistic tile chunks (spikes, ladders, pits) [U] (Part 2, not read). Lesson [I]: guarantee traversability first, then let templates add hazard combinations.

### 2.8 Nuclear Throne

Not researched (loop scaling skipped as lower value).

---

## 3. Touhou: boss and spell-card design

The Touhou Wiki was blocked (Cloudflare/418), so per-difficulty card lists could not be checked this session.

### 3.1 Structure

- Six stages that get harder regardless of difficulty, plus an Extra stage unlocked by a no-continue clear. Four difficulties: Easy, Normal, Hard, Lunatic [V] ([Wikipedia: Touhou Project](https://en.wikipedia.org/wiki/Touhou_Project)).
- **Spell cards.** Each boss has several attack phases. Each named card has its own lifebar and a countdown. Clearing in time gives a bonus, and **capture** (no life lost, no bomb) gives a capture bonus. On timeout the boss moves to the next attack with no bonus. EoSD has 64 cards in total, and **some cards are swapped or skipped depending on difficulty and shot type**. Easy ends after stage 5 [V] ([Wikipedia: EoSD](https://en.wikipedia.org/wiki/Embodiment_of_Scarlet_Devil)). Midbosses appear mid-stage and bosses at the end [V].
- Bosses alternate unnamed **nonspells** (breathers that share a bar) with named cards. Cards are named "Theme Sign 'Name'", for example Moon Sign "Moonlight Ray". **Survival or timeout cards** can only be waited out. "Last Spell" or "Last Word" cards close a fight [U].
- **Bombs and deathbombs.** A bomb grants invulnerability, clears bullets and deals heavy damage. A deathbomb within a short window after a hit saves the life (about 0.3 s in later games; six frames in EoSD, shrinking with each use) [V] (both Wikipedia pages).
- **Focus and hitbox.** Focus slows the player. From PCB onward it shows the tiny hitbox, much smaller than the sprite. Graze (bullets crossing the sprite but not the hitbox) scores points [V] ([Wikipedia: Touhou Project](https://en.wikipedia.org/wiki/Touhou_Project)).

### 3.2 Dynamic rank

- EoSD: rank 0–32, reset to 16 each stage, rising with survival time and with captured spell cards, and −16 per hit. Between minimum and maximum rank, boss bullet counts can differ by 4× or more and bullet speed can double [C] (single source: [Giant Bomb](https://www.giantbomb.com/games/3030-21928/)). Wikipedia describes a "Play Rank" that eases after a lost life and rises with score [V].
- PoFV (Th9) bullet speed is bounded at 0.8 to `3.0 + 0.1 × rank` [C] ([Maribel Hearn wiki: Th9](https://wiki.maribelhearn.com/wiki/Touhou_9:_Phantasmagoria_of_Flower_View)).

### 3.3 Pattern families and fairness

From [Boghog's bullet hell shmup 101](https://shmups.wiki/library/Boghog's_bullet_hell_shmup_101) [V]:

- **Aimed** patterns track the player: "good for pressure, allows conscious manipulation by the player". **Static** patterns are obstacles and give the designer control of shape. Mixing the two works: aimed bullets force movement and static bullets constrain it.
- Speed conveys force. Density conveys power. Speed must match the size of the play area.
- Readability: "chunking patterns is vital for visibility". Enemy bullets are drawn on top. Pair light and dark values. Unpredictable bullets need trails.
- Fairness: "single stray bullets are hard to read and can often feel unfair". Random patterns can create unfair situations. The games are "designed to let you avoid every single bit of damage with some practice". Generous post-hit invulnerability prevents chain deaths.
- A tiny, centred, consistent hitbox lets designers use heavy bullet counts.
- Rank can be a resource: kill fast and be rewarded, leave enemies alive and suffer.
- Clear telegraphing is a core flow tool.

Also from memory [U]: laser warning lines (a thin line before a laser fires); spawn flashes or "delay clouds" where bullets appear; **micro-dodging** (small weaves in dense streams) versus **macro-dodging** (relocating across the screen); **streaming** (moving steadily while aimed shots trail behind); and rings, spirals, walls and curvy lasers as the base vocabulary. Safespots (a standing spot no bullet reaches) are generally considered a design flaw in a card meant to test movement.

### 3.4 How tiers change the same card

[V]: cards are swapped or skipped by difficulty (EoSD). [U]: on the same card, Easy to Lunatic raise density (more ways per ring), speed, layers and aim (static to partly aimed). Some slots have *different cards with different names* on Hard and Lunatic, and Easy often has fewer cards per boss. Exact per-card examples (Remilia, Flandre, Yuyuko) are unverified this session.

---

## 4. Reaction time and telegraph fairness

- **Simple visual reaction time.** Mean 231 ms raw, or 213 ms corrected for hardware delay (N = 1469). By age group: 217.9 ms (18–24) to 239.1 ms (59–65), slope 0.55 ms/year. A second experiment found 237.8 ms [V] (Woods et al. 2015, *Front. Hum. Neurosci.* 9:131, [doi:10.3389/fnhum.2015.00131](https://www.frontiersin.org/articles/10.3389/fnhum.2015.00131/full)).
- **Choice reaction time** is longer than simple reaction time. Donders measured gaps of 60 to 200 ms, and course notes give 100 to 300 ms. Hick's law: reaction time grows with log2 of the number of choices [V] ([Wikipedia mirror: Mental chronometry](https://static.hlt.bme.hu/semantics/external/pages/pszichometriai_g-faktor/en.wikipedia.org/wiki/Mental_chronometry.html), [Nottingham course notes](https://psychology.nottingham.ac.uk/staff/lpzjd/psgy1001-21/why-rts-errors.html)).
- **Souls wind-ups.** No frame-data datamine of typical enemy anticipation was found. Long wind-ups (often a second or more on big swings) and short pokes that are telegraphed by stance are common knowledge [U].
- **Implications for our 280 ms floor** [I]:
  - A telegraph must cover reaction time + input-to-action time + display and network latency. With a 213–231 ms simple reaction time, about 50–100 ms of input/display lag, and our roll's i-frames starting at 30 ms, 280 ms is *just* enough for a one-answer telegraph ("roll now, any direction") seen by a young player.
  - Any telegraph that needs a *choice* (which way, walk out of a zone, `pierceRoll` areas) adds the 60–200 ms choice cost. Those need roughly 400 ms or more.
  - Co-op guests see enemy state late, but damage is victim-side (`TierDef.damage` comment), so the guest's own view is what counts. That is the right side for fairness.
  - `TUNING.roster.minTelegraphMs = 300` is already above the floor. Keep the floor as a hard minimum, not a target.

---

## 5. Cross-game design lessons (synthesis)

1. **Change the situation before the number** (SotFS placements, Nightreign variants, StS A17–19, Hades Extreme Measures, Dead Cells BSC 4 teleporting mobs) [I] from [V] sources.
2. **Elites with one legible behaviour** (Isaac champions, ETG Jammed, RoR2 affixes) beat HP sponges. The best ones create a kill-order or positioning puzzle [V]/[I].
3. **Budgets, not counts.** RoR2 spends credits and buys fewer, stronger units as the budget grows ("too cheap" rule) [V].
4. **Remove safety nets step by step** (Dead Cells flasks, StS healing) to raise stakes without stat inflation [V].
5. **Opt-in, named, ranked, one-axis modifiers** that pay more (Hades, StS, ETG curse with lower reward chance) [V]/[C].
6. **Cap the fight's length against build power** (ETG DPS cap, +70 % in co-op) so the player sees every pattern [V].
7. **Co-op scales sub-linearly** (RoR2 +0.3 per player; ER boss HP 1.6/2.3/2.7) [V].
8. **Every pattern avoidable, no single stray threat, clear tells, consistent delays** (shmups 101; Souls critiques) [V]/[C].
9. **Information is a difficulty axis** (Nightreign hides POIs and the Nightlord) [V].
10. **Fail-cost is a knob** (run-backs, restarts per floor, Nightreign's depth penalties and protection) [V]/[U].

---

## Propuesta para Mazmorra Sombría

> Todo lo que sigue es propuesta (inferencia de diseño, marcada [I] salvo que cite un dato). Los números son puntos de partida para medir con el arnés (§P7), no valores cerrados.

### P0. Principio rector

La dificultad se construye en este orden: **1) situación** (sala, colocación, combinación de papeles), **2) comportamiento** (patrones, combos, rasgos de élite, cartas), **3) información y coste del fallo** (avisos, reinicios, curación), y solo al final **4) números** (vida y daño). Cada capa sube por nivel (Fácil a Pesadilla) y por profundidad, y el arnés mide el resultado.

### P1. Caja de herramientas de encuentros para el generador

**Papeles de enemigo** (una etiqueta `role` por especie en `data/enemies.ts`; varios enemigos actuales ya encajan):

| Papel | Qué hace | Coste base de amenaza | Ejemplos posibles del roster (a confirmar) |
|---|---|---|---|
| Bruto | cuerpo a cuerpo lento, golpe fuerte, aguanta | 3 | Golett, Pawniard |
| Hostigador | rápido, entra y sale | 2 | Poochyena, Zubat |
| Tirador | distancia, castiga quedarse quieto | 3 | Hoothoot, Spinarak |
| Enjambre | débil, viene en grupo (`pack`) | 1 por unidad | Pumpkaboo pequeño |
| Controlador | zonas, ralentiza, niega espacio (`pierceRoll`, gas, charcos) | 4 | Foongus, Koffing, Grimer |
| Apoyo | mejora o cura a otros (se mata primero) | 4 | nuevo (élite «Pulso», ver P3) |

**Presupuesto de amenaza por sala** (al estilo del director de RoR2, gastado en papeles y no en número; el tope de enemigos por sala no cambia):

```
presupuesto(sala) = base_planta × nivel.amenaza × (1 + 0,06 × (profundidad − 1))
```

Valores propuestos de `nivel.amenaza`: Fácil 1,0 · Normal 1,15 · Difícil 1,3 · Pesadilla 1,5. Reglas de compra:

1. Con el tope de enemigos por sala fijo (`maxPerRoom`), un presupuesto mayor compra **mejores papeles** (un controlador en vez de dos hostigadores), no más cuerpos.
2. **Regla «demasiado barato»** (RoR2): si el presupuesto supera 6 veces el coste de un papel, ese papel no se compra suelto (solo como `pack` o junto a un élite).
3. **Combos con nombre** como plantillas preferidas: *yunque y martillo* (bruto que empuja hacia un tirador), *jaula* (controlador que cierra salidas y hostigadores dentro), *cebo* (enjambre delante y tirador detrás de un pilar), *guardaespaldas* (apoyo detrás de dos brutos). Fácil usa como mucho dos papeles por sala. Desde Difícil, tres.

**Plantillas de sala** (como Isaac y Gungeon: salas hechas a mano con peso, que el generador combina; como Spelunky: primero se garantiza el camino y luego se añaden peligros). Cada plantilla lleva etiquetas: `pillars` (cobertura), `pit` (foso), `ledge` (zona elevada o inalcanzable para el jugador, vale un borde de agua o un desnivel), `hazard` (gas, lava, trampas), `choke` (pasillo), `open` (arena). El generador cruza etiquetas y papeles:

- **Tirador** en `ledge` o detrás de `pillars`, a ≥ 1 sala de distancia visual del punto de entrada.
- **Bruto** cerca de `pit` solo si su empuje no puede tirar al jugador sin aviso (o el foso no mata en Fácil y Normal).
- **Controlador** en `choke` solo desde Difícil.
- **Emboscada** (enemigos dormidos que despiertan al entrar o al coger un objeto): como mucho una por planta en Normal y dos en Pesadilla, siempre con una pista visible (restos, sonido, objeto «demasiado fácil») y siempre con salida.
- **Patrullas**: un enemigo con ruta en bucle que se puede evitar o separar (el rango de aggro permite tirar de uno en uno, la lección de Sen's).
- **Salas de respiro**: una sala segura cada 3 o 4 salas de combate (bayas, tienda o solo silencio). En Pesadilla se espacian (cada 5), como Dead Cells quita fuentes.
- **Objetos cebo**: un premio visible en un saliente o junto a un foso, con una emboscada o un tirador cubriéndolo. La recompensa compensa el riesgo y es opcional.

### P2. Lo que cambia cada nivel (diseño antes que números)

| | Fácil | Normal | Difícil | Pesadilla |
|---|---|---|---|---|
| Papeles por sala | ≤ 2 | ≤ 2 | ≤ 3 | ≤ 3 |
| Combos con nombre | no | *cebo* | + *yunque y martillo*, *jaula* | todos |
| Emboscadas por planta | 0 | ≤ 1 | ≤ 1 | ≤ 2 |
| Salas de respiro | cada 3 | cada 3 | cada 4 | cada 5 |
| Élites (rasgos) | 0 | 10 % (tough/frenzied) | 20 % (+ rasgos de comportamiento) | 30 % (+ todos) |
| Jefes | cartas base | + 1 combo más largo | + ataques retardados, + carta extra en fase 2 | + carta de supervivencia, + peligro de arena |
| Coste del fallo | reinicios ∞ | ∞ | 1 | 0 |

### P3. Élites de comportamiento (de Isaac y Gungeon)

Hoy hay dos rasgos de estadística (`tough`, `frenzied`). Propuesta: añadir rasgos que **cambian lo que hace el jugador**, un rasgo por élite, legible de lejos (color y aura), datos en `ELITE_TRAIT_DEFS`:

| Rasgo | Efecto | Lectura | Desde |
|---|---|---|---|
| `pulse` (Pulsing Red) | los aliados a ≤ R recuperan vida mientras vive | matar primero | Difícil |
| `split` (Pulsing Green) | al morir se parte en dos con la mitad de vida | posición y área | Normal |
| `warded` (White) | invulnerable hasta que caen los demás | orden de muerte | Difícil |
| `phasing` (Translucent) | sus proyectiles atraviesan pilares | la cobertura no vale | Pesadilla |
| `volatile` (Dark Cyan) | explota al morir con aviso de 400 ms | apartarse tras rematar | Normal |

Regla de equidad: un golpe de élite nunca supera el `maxHitShare` (35 % de la vida de un inicial), igual que el Jammed de Gungeon pega «un corazón».

### P4. Jefes: lecciones de Souls y de Touhou

**Estructura de cartas** (de Touhou; hoy `danmakuCardAt` cicla cartas por `combosDone`):

1. **Las cartas van por barra de vida y con temporizador**: cada carta tiene su tramo de vida y su tiempo. Al vaciar el tramo o agotar el tiempo se pasa a la siguiente (sin premio si se agota). Entre cartas va una fase sin nombre (cuerpo a cuerpo y combos normales, la «nonspell»), que sirve de respiro y castigo.
2. **Número de cartas**: jefe intermedio 1 o 2, guardián 3 o 4, guardián final 5. Pesadilla añade una carta extra o cambia la última por una variante con otro nombre (como EoSD cambia o salta cartas según la dificultad).
3. **Temporizador** = 2 × el tiempo de vaciado medido por el bot «medio» del arnés (P7) con 1 jugador. Así agotar el tiempo es un fallo suave y no un muro.
4. **Cartas de supervivencia** (no se pueden dañar, solo aguantar 15 a 20 s): solo desde Difícil y como mucho una por jefe. Son el equivalente de «muévete o muere» con `pierceRoll`.
5. **Premio de captura**: superar una carta sin recibir golpes da Pokémonedas extra a cada jugador que no fue golpeado (por jugador, no por grupo) y cuenta en los récords del nivel.
6. **Nombres**: «Signo Tema "Nombre"» (por ejemplo, Signo Espectral «Lluvia de Faroles») para dar identidad y que el jugador hable de «la carta tal».

**Cómo un nivel modifica la misma carta** (perillas separadas, con topes):

| Perilla | Normal | Difícil | Pesadilla | Tope |
|---|---|---|---|---|
| Densidad (vías por anillo, balas por ráfaga) | ×1,15 | ×1,3 | ×1,5 | ×2 y hueco ≥ 2 × diámetro del jugador |
| Velocidad de bala | ×1 | ×1,1 | ×1,15 | ×1,3 |
| Capas | base | + una capa estática | + una capa apuntada | 3 capas |
| Puntería | estática | parte apuntada | apuntada + estática | — |

Regla: **en una misma carta no suben a la vez densidad y velocidad por encima de ×1,3 cada una**. Si sube una, la otra se queda.

**Lecciones de Souls para los ataques**:

- **Ataques retardados con retraso fijo por movimiento** (se aprenden). Nunca se lanza un ataque en respuesta al botón del jugador.
- **Combos de longitud variable** (2 a 4 golpes) en Difícil y Pesadilla. El último golpe tiene un aviso distinto y siempre deja una ventana de castigo de ≥ 600 ms.
- **La fase 2 añade movimientos y no solo números** (como Gael o Midir): cada guardián gana 1 o 2 movimientos nuevos en fase 2, y Pesadilla añade un peligro de arena (zona `pierceRoll` periódica o un borde que se cierra).
- **Dúos**: el segundo enemigo presiona desde una dirección legible y nunca lanza su aviso a la vez que el primero sobre el mismo jugador (lección de Ornstein y Smough).
- **Movimiento contraintuitivo** (como Danza del Ave Acuática, donde rodar es la respuesta equivocada): aviso ≥ 500 ms y una señal visual y sonora propias.

### P5. Reglas de equidad (comprobables con tests)

1. **Nunca dos amenazas no vistas a la vez**: como mucho una amenaza fuera de pantalla por jugador, y ningún ataque que dañe sin haber estado en pantalla durante todo su aviso.
2. **Suelo de aviso**: 280 ms solo para avisos de una respuesta («rueda ya»). **400 ms** para los que exigen elegir dirección o salir de una zona (`pierceRoll`, por el coste de elegir, §4). Se mantiene el 75 % de la base.
3. **Fichas de ataque**: como mucho 2 enemigos en fase de aviso contra el mismo jugador a la vez. Desde Pesadilla, 3 (el resto espera).
4. **Combos legibles**: cada golpe de un combo tiene su aviso y el último deja recuperación.
5. **Sin balas sueltas aleatorias**: la aleatoriedad va en ángulos acotados con la semilla del núcleo determinista.
6. **Tope de golpe**: ningún golpe supera `maxHitShare` (35 %) en ningún nivel, ni siquiera con la profundidad. Si la escala lo superaría, se limita.

### P6. Números (apéndice práctico): una sola función de balance

Una función en `core/difficulty.ts` que compone todo:

```
mult(stat, enemigo) = nivel[stat] × profundidad[stat](f, t) × grupo[stat](n, clase) × élite[stat]
```

- **Nivel**: los multiplicadores actuales se **comprimen** un poco, porque la dificultad pasa a P1 a P4.
- **Profundidad (Sima)**: coeficiente al estilo de RoR2 pero suave, con un término de tiempo pequeño que castiga quedarse en una planta:

  ```
  c(f, t) = (1 + 0,01 × minutos_en_la_planta) × 1,05^(f − 1)        (tope c ≤ 4)
  vida  = c
  daño  = 1 + 0,5 × (c − 1)        (tope 2,5; y siempre el tope de golpe del 35 %)
  presupuesto de amenaza: + 0,06 por planta (P1)
  ```

  Con jugador y equipo topados en Modo puro (nivel 10 = 172 PV, ×1,45 daño), el exponencial suave hace que la Sima tenga un final natural sin muro abrupto.
- **Grupo (cooperativo)**: hoy no existe. Se toma la forma sublineal de Elden Ring (jefes con ID 300: ×1,6/2,3/2,7) y de RoR2:

  | Jugadores | 1 | 2 | 3 | 4 |
  |---|---|---|---|---|
  | Vida de jefe | ×1 | ×1,6 | ×2,1 | ×2,6 |
  | Vida de enemigo normal | ×1 | ×1,25 | ×1,4 | ×1,55 |
  | Daño enemigo | ×1 | ×1 | ×1,05 | ×1,1 |
  | Aguante de aturdimiento del jefe (P6b) | ×1 | ×1,4 | ×1,8 | ×2,2 |
  | Tope de DPS del jefe | ×1 | ×1,7 | ×2,2 | ×2,6 |

  Las cartas de jefe **no** suben de densidad con el grupo (Touhou: el patrón es para cada jugador). Sube la vida.
- **Tope de DPS en jefes** (Gungeon): `dps_max = 2,5 × daño_esperado_nivel(f) × grupo`, medido en ventana de 3 s, un golpe ≤ 3 × tope. Así ningún objeto o combo se salta cartas.
- **Recompensa**: `monedas = base × nivel.coins × (1 + 0,03 × (f − 1)) × (1 + capturas × 0,1)`. Se mantienen `coins` del nivel; el premio de captura es por jugador.

**P6b. Aturdimiento y superarmadura** (de DS3: el poise se regenera tras un rato sin daño): jefes y élites tienen una barra oculta de aguante. Cada golpe resta `potencia × factor_mov`. Si llega a 0 hay **ruptura** (1,2 s aturdido, el siguiente golpe ×1,5). Tras 3 s sin daño se rellena. Algunos movimientos tienen **superarmadura** en su aviso (no se interrumpen), marcada con un brillo propio. Desde Difícil, más movimientos la tienen; la superarmadura nunca va en los movimientos con aviso corto.

**P6c. Curva ataque contra defensa** (solo si se añaden objetos de defensa): no restar, sino usar la curva por tramos de DS3 [V] ([wikidot DS3](https://darksouls3.wikidot.com/combat-game-mechanics)), con r = ATQ/DEF:

```
r ≤ 0,125         → 0,10 × ATQ
0,125 < r ≤ 1     → (19,2/49 × (r − 0,125)² + 0,1) × ATQ
1 < r ≤ 2,5       → (−0,4/3 × (r − 2,5)² + 0,7) × ATQ
2,5 < r ≤ 8       → (−0,8/121 × (r − 8)² + 0,9) × ATQ
r > 8             → 0,90 × ATQ
```

(Continua: 0,1 · 0,4 · 0,7 · 0,9 en los cortes.) Después se aplica la absorción multiplicativa: `daño × Π(1 − absorción_i)`. El suelo del 10 % mantiene el daño de roce con sentido, sin el colapso a 1 de una resta.

**Tabla actual frente a propuesta**:

| | Actual Fácil/Normal/Difícil/Pesadilla | Propuesta |
|---|---|---|
| Vida enemiga | 1 / 1,15 / 1,3 / 1,45 | 1 / 1,1 / 1,2 / 1,3 |
| Daño enemigo | 1 / 1,15 / 1,3 / 1,5 | 1 / 1,1 / 1,25 / 1,4 (tope de golpe 35 %) |
| Aviso | 1 / 0,95 / 0,9 / 0,85; suelo 280 ms y 75 % | igual; suelo 400 ms para avisos de elección |
| Esperas | 1 / 0,9 / 0,8 / 0,7 | igual |
| Élites | 0 / 0,1 / 0,2 / 0,3 (2 rasgos) | igual, con rasgos de comportamiento (P3) |
| Amenaza por sala | (no existe) | 1 / 1,15 / 1,3 / 1,5 |
| Voltereta (i-frames/estamina) | 1/1/0,9/0,8 · 1/1/1,1/1,2 | igual |
| Sima, vida | 1 + 0,08 (f−1), tope 4 (planta 10: 1,72; 20: 2,52) | 1,05^(f−1) × tiempo, tope 4 (planta 10: 1,55; 20: 2,53; 30: 4,0) |
| Sima, daño | 1 + 0,05 (f−1), tope 3 (planta 10: 1,45; 20: 1,95) | 1 + 0,5 (c − 1), tope 2,5 (planta 10: 1,28; 20: 1,76) |
| Sima, enemigos por sala | 1 + ⌊0,34 (f−1)⌋, tope 5 | igual; la profundidad gasta presupuesto en papeles |
| Cooperativo | (no existe) | tabla de P6 |

### P7. El arnés de balance: medir, no adivinar

El núcleo es determinista (`core/rng.ts`, `core/step.ts`, `core/timestep.ts`). Propuesta: `tests/balance/` (o un script `npm run balance`) que simula plantas enteras con bots y escribe una tabla.

- **Bots**:
  - *Perfecto*: esquiva todo aviso visible tras 0 ms.
  - *Medio*: reacción de 230 ms ± 40 (Woods 2015) + 100 ms si el aviso exige elección; acierta el 85 % de las esquivas; ataca en la ventana de castigo.
  - *Novato*: 300 ms, 60 % de acierto, a veces gasta estamina hasta quedarse sin ella.
  - *Pegador*: no esquiva (mide el daño máximo y el tope de golpe).
- **Métricas por planta, nivel y tamaño de grupo** (1 a 4 bots): tiempo para matar (TTK) por sala y por carta de jefe, daño recibido por sala, muertes, porcentaje de golpes recibidos por tipo de aviso (normal, `pierceRoll`, combo), y el golpe máximo como fracción de la vida.
- **Bandas objetivo** (para empezar): con el bot *medio*, Fácil ≤ 25 % de vida perdida por planta, Normal ≤ 35 %, Difícil ≤ 50 %, Pesadilla ≤ 65 %. El *perfecto* nunca muere (si muere, hay un patrón inevitable). El *pegador* nunca recibe un golpe > 35 %. TTK de carta entre 0,4 y 0,8 del temporizador.
- **CI**: el arnés corre con semillas fijas y falla si una métrica sale de su banda. Cada pase de balance cambia números, vuelve a correr el arnés y anota el antes y el después en el documento de la tarea.
- **Prueba de que el arnés puede fallar**: un test que mete a propósito un patrón sin hueco y comprueba que el bot *perfecto* muere y el arnés lo marca. Sin eso, la puerta no comprueba nada.

### P8. Por encima de Pesadilla: pactos opcionales

Siguiendo Hades, Slay the Spire y la Maldición de Gungeon: modificadores con nombre, por rangos, de un solo eje, que pagan más. Desbloqueo tras superar Pesadilla. Ejemplos:

| Pacto | Eje | Rangos |
|---|---|---|
| Medidas Extremas | cada guardián gana su carta y movimientos de «Lunatic» | 1 por guardián |
| Sin Bayas | curación −25 % | 3 |
| Escolta | un élite extra en cada sala de guardián intermedio | 1 |
| Reloj Apretado (Sima) | −20 % de tiempo por planta | 2 |
| Niebla | el mapa no muestra la sala del jefe (Nightreign) | 1 |
| Sombra (como la Maldición) | +probabilidad de élite y menos premio por sala; al máximo, un perseguidor invencible y lento | 5 |

Cada rango suma «Calor» y multiplica monedas y récords. En cooperativo los elige el anfitrión, igual que el nivel.

### P9. Recomendaciones principales (por orden)

1. Construir el arnés (P7) **antes** de cambiar ningún número.
2. Añadir la escala cooperativa (P6), que hoy no existe y es el mayor agujero de balance.
3. Pasar las cartas de jefe a tramos de vida con temporizador y premio de captura (P4).
4. Etiquetar papeles y plantillas de sala y gastar el presupuesto de amenaza en papeles (P1 y P2).
5. Añadir 2 o 3 rasgos de élite de comportamiento (P3).
6. Subir el suelo de aviso a 400 ms para los avisos de elección y de `pierceRoll` (P5).
7. Comprimir los multiplicadores de vida y daño de los niveles cuando lo anterior ya dé la dificultad (P6).

---

## Appendix A: stat scaling in the Souls games (short)

**Elden Ring NG+** [V] ([Fextralife: New Game Plus](https://eldenring.wiki.fextralife.com/New+Game+Plus)). NG+1 is applied *per area* through SpEffects 7400–7600, so early areas get much more than late ones. HP goes from ×3.434 at the Stranded Graveyard down to ≈ ×1.0 in late areas. Attack goes from ×1.902 down to ≈ ×1.09–1.13, defense ×1.17–1.2, and runes ×5 early down to ×2 late. The base game has its own per-area set, SpEffects 7000–7200. NG+2 to NG+7 multiply the NG+ values:

| Cycle | HP | Defense | Poise dmg | Attack | Stamina dmg | Runes |
|---|---|---|---|---|---|---|
| NG+2 | 1.10 | 1.025 | 0.95 | 1.10 | 1.40 | 1.10 |
| NG+3 | 1.15 | 1.05 | 0.90 | 1.15 | 1.50 | 1.125 |
| NG+4 | 1.20 | 1.10 | 0.85 | 1.20 | 1.60 | 1.20 |
| NG+5 | 1.30 | 1.15 | 0.80 | 1.30 | 1.70 | 1.225 |
| NG+6 | 1.35 | 1.20 | 0.70 | 1.35 | 1.80 | 1.25 |
| NG+7 | 1.45 | 1.30 | 0.60 | 1.45 | 1.90 | 1.275 |

Scaling ends at NG+7. Boss HP = base × region multiplier × multiplayer multiplier × NG+ multiplier [V]. The "clear count" mechanism behind the SpEffect selection is not described on that page [gap].

**Dark Souls 3 NG+** [V/C] ([Fextralife](https://darksouls3.wiki.fextralife.com/New+Game+Plus)): the multipliers depend on area, NG+2 to NG+7 use NG+ as the base, enemies take less poise damage from NG+2, and growth stops after NG+7. Exact numbers are only in an image (not transcribed).

**Dark Souls 1 NG+** [C] ([Fextralife](https://darksouls.wiki.fextralife.com/New+Game+Plus)): NG+ gives many enemies about double HP and much more damage, with souls ×2 to ×4. Souls and HP over NG+ rise +7 % (NG++), +10 %, +14 %, +19 % and +25 % (NG+6 onward).

**Elden Ring co-op (Multiplayer Correction)** [V] ([eldenring.wiki.gg](https://eldenring.wiki.gg/wiki/Multiplayer_Correction), page edited 31 December 2024):

| ID class | HP ×, 1 / 2 / 3 helpers | Attack ×, 1 / 2 / 3 helpers | Poise-damage taken ×, 1 / 2 / 3 helpers |
|---|---|---|---|
| 100 (regular) | 1.25 / 1.35 / 1.5 | 1 / 1 / 1 | 1 / 1 / 1 |
| 200 | 1.3 / 1.5 / 1.6 | 1 / 1 / 1 | 1 / 1 / 1 |
| 300/400 (bosses) | 1.6 / 2.3 / 2.7 | 1 / 1.1 / 1.15 | 0.6 / 0.35 / 0.25 |
| 10000300 (DLC bosses) | 1.75 / 2.68 / 3.21 | 1 / 1.1 / 1.15 | 0.55 / 0.3 / 0.21 |

Status resistance goes ×1.5 to ×2.5 (bleed and frost build up slower). Damage rises only from 2 helpers. The 3-helper row is largely unused, a remnant of DS3's 4-player sessions. No correction applies if the helpers are gone before the fog. The "×2.2" figure in the brief is not supported; the verified boss value is ×2.3 for 2 helpers. DS3's per-phantom table was not retrieved [gap].

**Damage formula, DS3 (App 1.10+)** [V] ([wikidot](https://darksouls3.wikidot.com/combat-game-mechanics); the DS1 wiki gives the same curve): see P6c. The output is continuous at 0.1 / 0.4 / 0.7 / 0.9 for ATK/DEF = 0.125 / 1 / 2.5 / 8. Absorption is a percentage applied after defense and stacks multiplicatively: `1 − Π(1 − a_i)`. Poise regenerates fully after a period without damage, and bosses are generally immune to knockdown [V]. Elden Ring is widely believed to use the same curve family with different breakpoints [U]; no verified ER constants were found.

## Appendix B: other difficulty knobs (brief)

- **Hollow Knight**: Radiant (Hall of Gods) makes any hit lethal, same patterns. Steel Soul is permadeath. Pantheons chain bosses with no healing between [U].
- **Sekiro**: Demon Bell raises enemy aggression and damage, and Charmless halves posture damage dealt and raises damage taken [U].
- **Hades**: see §2.3.

---

## 8. Unverified items and gaps

- Touhou per-difficulty card lists (Remilia, Flandre, Yuyuko), survival cards, last spells, naming rules, and EoSD rank numbers beyond Giant Bomb (Touhou Wiki blocked).
- Hades exact per-rank values for Benefits Package, Middle Management, Damage Control, Approval Process, Tight Deadline and Personal Liability, and Extreme Measures heat costs (primary wikis blocked).
- Elden Ring attack/defense curve constants. The "clear count" SpEffect selection mechanism.
- DS3 NG+ numbers (image only). DS3 multiplayer boss HP per phantom.
- DS2 SotFS full enemy diff. DS2 NG+ added phantoms. Anor Londo, Blighttown and mimic examples, and the Gael, Midir and Bed of Chaos critiques (no critic source retrieved).
- Nightreign per-Depth stat values (no datamine found).
- Isaac room difficulty values, curses, boss HP per stage, Greed mode. ETG boss HP formula, Rainbow and challenge modes. Spelunky chunk templates (Part 2). Nuclear Throne (skipped).
- Souls wind-up frame data (no datamine of anticipation frames found).
- Hollow Knight and Sekiro modifier details (Appendix B, from memory).
