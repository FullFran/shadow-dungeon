# Species candidates (starters, enemies, guardians, final boss)

Research note, not a design decision. Every species below was checked against the real
PMDCollab SpriteCollab data on 2026-10-25 (`master` branch, read-only, nothing downloaded into the repo).

## How this was verified

| Source | What it gave |
|---|---|
| `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/tracker.json` | Per species and form: sprite phase, list of animation names (`sprite_files`), sprite credit (primary, secondary, total) |
| `.../credit_names.txt` | Discord id to display name for the credit column |
| `.../sprite/<dex>[/<form>]/AnimData.xml` | Spot checks (25 folders): frame sizes, frame counts, and `CopyOf` aliases |
| `.../sprite/0800/credits.txt`, `.../sprite/0800/0003/credits.txt` | Spot check of the per-sheet license column |

Phases in the tracker: `0` = incomplete or no sprite, `1` = exists (the standard set is there), `2` = fully featured (adds the extra animations: Faint, DeepBreath, Cringe, Float and others).

What the game needs, from `tools/fetch-sprites.mjs` (`WANTED`) and `src/data/sprite-meta.json`:

| Game animation | SpriteCollab source, then fallbacks |
|---|---|
| Idle | Idle, Walk |
| Walk | Walk, Idle |
| Attack | Attack, Strike, Swing, Idle |
| Shoot | Shoot, Attack, Idle |
| Charge | Charge, DeepBreath, Idle |
| Hurt | Hurt, Cringe, Idle |
| Faint | Hurt, Idle (SpriteCollab has a `Faint` sheet only on phase-2 species; the tool does not request it today) |
| Optional | Strike, Swing, Double, Hop, Rotate |

"Core 6" below means Idle, Walk, Attack, Shoot, Charge, Hurt. A missing Shoot is not fatal (the tool falls back to Attack), but the projectile move then plays a melee-looking animation.

### Gotchas found while checking

1. **The tracker lists `CopyOf` aliases as if they were sheets.** Litwick, Trevenant and Sableye list `Shoot`, but their `AnimData.xml` says `Shoot` is `CopyOf Charge`. `pickAnim` already resolves this, so it works, but "Shoot exists" in the tracker does not guarantee a distinct shooting pose. Only the 25 folders in the frame-size table were checked for this.
2. **Necrozma Dusk Mane and Dawn Wings have no sprites.** The tracker has slots `0800/0001` and `0800/0002` at phase 0 with no files and no credit; their `AnimData.xml` returns 404.
3. **Mimikyu has a Busted form** (`0778/0001`, phase 1, all Core 6, same artist). The M0 only fetches `0778/0000`; the broken-disguise state could swap to it.
4. **The license column of `credits.txt` is not uniform.** Necrozma's older entries say `PMDCollab_1` and the 2026-09 rework says `CC_BY-NC_4`. The SpriteCollab README states that submissions are shared under CC BY-NC terms. Species credited to `CHUNSOFT` are the official PMD sprites. I did not read `credits.txt` for every species below, so the per-sheet license is **not verified** except for Necrozma.

## 1. Starters

Mimikyu stays the M0 playable and a gacha unit; these are the three starters you pick from at the start of a run (the isekai arrival), plus one alternate per play style. All six are phase 2 (fully featured) except where noted, so they also have native Faint, DeepBreath and Cringe sheets.

### Recommended trio

| Style | Species (type) | Why it fits | Sprite status |
|---|---|---|---|
| Fast melee | **Zorua** (Dark) | A fox of illusions; small, cute and mischievous, but "the shadow that wears your face" suits the eclipse | Phase 2, Core 6 all present, has Strike, Double, SpAttack. Credit: Emmuffin + baronessfaron |
| Ranged caster | **Litwick** (Ghost/Fire) | A candle that drains life to burn; reads instantly on stream, and its flame lights a dark crypt | Phase 2, Core 6 present (Shoot is a copy of Charge), has Strike, SpAttack. Credit: Emmuffin |
| Guard / bruiser | **Cubone** (Ground) | The lonely Pokémon in its mother's skull; sad, cute, iconic, and its bone is a natural parry tool | Phase 2, Core 6 all present, has Strike, SpAttack. Credit: CHUNSOFT + Sceptile, Some_Shinx (4 total) |

Type spread: Dark hits the Ghost-heavy crypt and forest, Fire hits the Steel guardian (Aegislash) and the Grass forest, Ground hits Steel, Poison (swamp) and Fire. Against the dungeon-1 boss's Ghost attacks, Zorua resists, Cubone is neutral and Litwick is weak, so the ranged pick is the risky one there.

### Alternates

| Style | Species (type) | Why it fits | Sprite status |
|---|---|---|---|
| Fast melee | **Absol** (Dark) | The disaster Pokémon that appears before calamities: a born herald of the Crimson Eclipse | Phase 2, Core 6 present, **no Strike** (has Swing, Double, SpAttack). Credit: CHUNSOFT + Deeshura, Top_Kec |
| Ranged caster | **Misdreavus** (Ghost) | A screeching little ghost; very Touhou-like (floating, bullet hexes) | Phase 2, Core 6 present, has Strike, SpAttack. Credit: CHUNSOFT + Emboarger |
| Guard / bruiser | **Honedge** (Steel/Ghost) | A blade possessed by a spirit; a lost sword of the Sword King, so the dungeon-1 boss is personal | Phase 2, Core 6 present, **no Strike** (has Swing). Credit: Emmuffin |

Bench (also verified, not chosen): Riolu (phase 2, **no Shoot**), Eevee (phase 2) and Umbreon (phase 2, moonlight eclipse theme), Rockruff (phase 2) with Lycanroc Dusk (`0745/0002`, phase 2), Pawniard (phase 2), Shinx (phase 2), Charcadet (phase 2), Litten (phase 2, no Strike), Murkrow (phase 2).

### Kit sketches (slot model from GDD §4)

Fast slot = left click (quick, short recovery). Heavy slot = right click (slow start, stamina, chargeable). Names are the official English move names, adapted.

**Zorua (Dark), fast melee**

| Slot | Move | How it plays | Animation |
|---|---|---|---|
| Fast | Fury Swipes | Three quick claws; each hit in a combo is a little faster | Double / Attack |
| Fast | Feint Attack | Short blink-dash that ends behind the target if it is locked | Strike |
| Heavy | Night Daze | Charge, then a dark shockwave ring around you; bigger when charged | SpAttack / Charge |
| Heavy | Foul Play | Charged lunge; bonus damage if the target is mid-attack (punishes telegraphs) | Charge then Attack |
| Passive | Illusion | You enter each floor disguised; enemies do not aggro until you attack or touch them, and your first attack from Illusion is a crit | Idle (tint) |

**Litwick (Ghost/Fire), ranged caster**

| Slot | Move | How it plays | Animation |
|---|---|---|---|
| Fast | Ember | Small quick bolt toward the cursor; can apply Burn | Shoot (copy of Charge) |
| Fast | Astonish | Point-blank flinch poke to make space | Attack |
| Heavy | Hex | Slow homing wisp; double damage on burned targets; charged = 3 wisps | Charge then Shoot |
| Heavy | Inferno | Slow big orb that bursts into a fire ring; charged = larger ring | SpAttack |
| Passive | Flash Fire | Fire hits on you are absorbed (heal a little, power up the next heavy); a perfect dodge through a fire attack counts as absorbing it | - |

**Cubone (Ground), guard / bruiser**

| Slot | Move | How it plays | Animation |
|---|---|---|---|
| Fast | Bone Club | Short swing that staggers small enemies | Attack |
| Fast | Bone Rush | Three forward jabs that push you slowly forward | Double / Strike |
| Heavy | Bonemerang | Charged throw that flies out and returns, hitting on both passes | Shoot |
| Heavy | Stomping Tantrum | Charged ground slam; stronger if your previous attack missed (grief turned into rage) | Charge then SpAttack |
| Passive | Battle Armor | During a heavy windup, frontal hits deal half damage and cannot interrupt you (souls hyper armor) | - |

**Absol (Dark), fast melee alternate**

| Slot | Move | How it plays | Animation |
|---|---|---|---|
| Fast | Night Slash | Wide arc, high crit chance | Swing |
| Fast | Quick Attack | Fast dash strike that closes distance | Attack |
| Heavy | Razor Wind | Charge, then a crescent wave that travels | Charge then Shoot |
| Heavy | Future Sight | Marks a spot; it explodes after 1.5 s (charged = bigger, later) | SpAttack |
| Passive | Super Luck / Omen | Enemy telegraphs show 0.2 s earlier for you | - |

**Misdreavus (Ghost), ranged alternate**

| Slot | Move | How it plays | Animation |
|---|---|---|---|
| Fast | Astonish | Short poke with flinch | Attack |
| Fast | Shadow Sneak | Fast shadow that travels along the floor (through low walls) | Shoot |
| Heavy | Shadow Ball | Slow orb; charged = bigger and faster (same as Mimikyu's) | Charge then Shoot |
| Heavy | Perish Song | Charged; marks every enemy in a radius, they take a burst 3 s later | SpAttack |
| Passive | Levitate | Floats over pits, water and floor traps | Float |

**Honedge (Steel/Ghost), guard alternate**

| Slot | Move | How it plays | Animation |
|---|---|---|---|
| Fast | Fury Cutter | Slash whose damage ramps on consecutive hits | Swing |
| Fast | Shadow Sneak | Quick shadow strike from a short distance | Attack |
| Heavy | Sacred Sword | Charged thrust that ignores guard and stat boosts | Charge then Attack |
| Heavy | Iron Head | Charged spinning dash; flinch on hit | Rotate |
| Passive | No Guard | Your heavies cannot be blocked by shields (Aegislash's Shield form, Golett's guard), but you cannot perfect-dodge | - |

## 2. Dungeons, regular enemies and guardians

Behaviour keys: **lunger** (telegraph with Charge, then a straight dash), **ranged** (keeps distance, slow readable projectile), **tank** (slow, high HP, guard or armor), **swarmer** (weak, comes in groups), **phaser** (ghost that moves through walls), **ambusher** (hides as scenery or item), **zoner** (leaves hazards on the floor).

Status column: phase, then missing Core 6 animations (`-` means none missing), then credit (primary + secondary).

### Dungeon 1: Crypt of the Sword King

Lore: the tomb of a king whose blade was possessed when the eclipse first rose; his discarded swords still guard the halls.

| Role | Species (type) | Behaviour | Status |
|---|---|---|---|
| Lunger | Poochyena (Dark) | M0 enemy: stalks, Charge, straight lunge, punishable on dodge | Phase 2, -, CHUNSOFT + Smalusion |
| Ranged / phaser | Gastly (Poison/Ghost) | M0 enemy: floats over obstacles, slow ball | Phase 1, -, CHUNSOFT |
| Phaser / tank | Duskull (Ghost) | Slow; drifts through walls; Will-O-Wisp telegraphed with a glow | Phase 1, -, CHUNSOFT + JFain |
| Tank | Golett (Ground/Ghost) | Slow stomper with a big frontal slam; armored from the front | Phase 2, -, Soulja |
| Swarmer | Pawniard (Dark/Steel) | Packs of 3; quick slashes, low HP; the king's foot soldiers | Phase 2, -, baronessfaron |
| Ambusher (option) | Sableye (Dark/Ghost) | Glints in the dark, then jumps out | Phase 1, - (Shoot is copy of Charge), CHUNSOFT |

**Guardian: Aegislash** (Steel/Ghost). Phase 1, Core 6 present in both forms, no Strike. Shield `0681`, Blade `0681/0001` (form name "Blade" verified). Credit: Top_Kec.
Concept: shield phase you must circle; blade phase of wide combos with clear openings.

| Spell card | Pattern |
|---|---|
| Royal Sign "King's Shield Rebuke" | Blocks from the front; hitting the shield reflects a ring of slow blades |
| Regicide "Sacred Sword Waltz" | Blade form: three-step slash combo that ends in a long recovery |
| Eclipse Edict "Shadow Sneak of the Hundred Blades" | Shadows race along the floor toward your position, one after another |

### Dungeon 2: Misty Forest

Lore: a forest where the fog is the breath of the dead; lost travellers become the trees.

| Role | Species (type) | Behaviour | Status |
|---|---|---|---|
| Phaser | Phantump (Ghost/Grass) | Passes through tree walls, grabs and drains | Phase 1, -, Emmuffin + ShyStarryRain |
| Swarmer / tank by size | Pumpkaboo (Ghost/Grass) | Small = fast swarm, Large/Super = slow tank; same species, four forms | Phase 1, - in all four forms (base, Small, Large, Super), baronessfaron |
| Ambusher / zoner | Foongus (Grass/Poison) | Looks like an item on the floor; spore cloud when you get close | Phase 1, -, JFain |
| Ranged | Spinarak (Bug/Poison) | String Shot that slows; keeps distance | Phase 1, -, CHUNSOFT |
| Lunger (flying) | Hoothoot (Normal/Flying) | Circles, then dives; at night it can cast Hypnosis | Phase 1, -, CHUNSOFT |
| Trickster (option) | Impidimp (Dark/Fairy) | Fakes a lunge, then strikes from the side | Phase 1, -, baronessfaron |

**Guardian: Decidueye** (Grass/Ghost). Phase 1, Core 6 present, has Strike. Credit: Reimu_needs_$$$ + Audino. A Hisuian form also exists (`0724/0001`, phase 1, baronessfaron).
Concept: a hooded archer that disappears into the fog and fires from the treeline.

| Spell card | Pattern |
|---|---|
| Shadow Quill "Spirit Shackle Thicket" | Arrows pin your shadow; standing still too long roots you |
| Fog Sign "Leaf Blade Requiem" | Teleports to the fog edge and fires fans of leaves |
| Owl Sign "Brave Bird of the Hollow Moon" | Charges a long dive across the arena; dodge sideways |

Fallback guardian: Trevenant (phase 1, -, Shoot is copy of Charge, baronessfaron). **Gaps:** Amoonguss and Shiinotic have no sprite (phase 0).

### Dungeon 3: Flooded Caves

Lore: a drowned shrine whose bell still rings under the water at each eclipse.

| Role | Species (type) | Behaviour | Status |
|---|---|---|---|
| Swarmer (flying) | Zubat (Poison/Flying) | Flocks that swoop in waves; ignore water tiles | Phase 1, -, has Hover, CHUNSOFT |
| Zoner / tank | Tentacool (Water/Poison) | Sits in water, lashes when you pass, leaves poison pools | Phase 1, -, CHUNSOFT |
| Ranged (lure) | Chinchou (Water/Electric) | Glowing lure in the dark; Thunder Wave bolts | Phase 1, -, CHUNSOFT (Lanturn is phase 2) |
| Lunger | Corphish (Water) | Sideways scuttle, then a claw lunge | Phase 2, -, CHUNSOFT + Caitemis |
| Sniper | Clauncher (Water) | Long charge, then a fast water shot down a line | Phase 1, -, Jhony-Rex + baronessfaron |
| Tank (option) | Wooper (Water/Ground) | Slow, high HP, cute; mud puddles | Phase 2, -, CHUNSOFT + Anon, Uni |

**Guardian: Dhelmise** (Ghost/Grass). Phase 1, Core 6 present, has Strike. Big frames (Idle 48x96, Attack 96x96). Credit: baronessfaron.
Concept: a sunken anchor possessed by seaweed; it drags the arena's water with it.

| Spell card | Pattern |
|---|---|
| Anchor Sign "Drowned Bell's Undertow" | Each swing pulls you toward it; the bell ring is the telegraph |
| Tide Sign "Phantom Force Riptide" | Sinks into the water, reappears under you |
| Kelp Sign "Power Whip Labyrinth" | Kelp walls sweep the room in rotating bars |

Fallback guardian: Gyarados (phase 1, -, very large: Idle 72x128). **Gaps:** Frillish has no sprite; Jellicent is phase 0 with only Walk/Idle/Swing/Rotate (missing Attack, Shoot, Charge, Hurt).

### Dungeon 4: Toxic Swamp

Lore: where the eclipse's light first leaked from another world; the water itself is poison. Foreshadows Ultra Space.

| Role | Species (type) | Behaviour | Status |
|---|---|---|---|
| Tank / zoner | Grimer (Poison) | Slow; leaves a sludge trail that slows you | Phase 1, -, CHUNSOFT (Alolan form `0088/0001` also phase 1) |
| Ranged / zoner | Koffing (Poison) | Floats; drops gas clouds that linger | Phase 1, -, no Strike, CHUNSOFT |
| Lunger | Ekans (Poison) | Coils (Charge), then a long straight strike | Phase 2, -, CHUNSOFT + Emmuffin |
| Counter | Croagunk (Poison/Fighting) | Waits; if you attack into it, it counter-punches | Phase 2, -, CHUNSOFT + Caitemis |
| Swarmer | Stunky (Poison/Dark) | Groups that spray from behind | Phase 2, -, no Strike, CHUNSOFT + JFain |
| Ranged (option) | Skrelp (Poison/Water) | Hides in water, spits ink | Phase 1, -, Top_Kec |

**Guardian: Nihilego** (Rock/Poison, Ultra Beast). Phase 1, Core 6 present, has Strike. Credit: Emmuffin.
Concept: a parasite from beyond the eclipse; the first clear sign that something came through the hole in the sky.

| Spell card | Pattern |
|---|---|
| Parasite Sign "Beast Boost Bloom" | Each hit it lands makes the next pattern faster |
| Ultra Sign "Power Gem Constellation" | Gems spread in a slow-rotating star; gaps are safe lanes |
| Toxic Sign "Venoshock Downpour" | Poison rain marks circles on the floor; standing in poison doubles the damage |

Fallback guardian: Salazzle (phase 1, -, Soulja).

### Optional extra themes (all verified)

| Theme | Regular enemies (phase, missing) | Guardian (phase, missing) | One-line concept |
|---|---|---|---|
| Frozen Ossuary | Snorunt (2, -), Sneasel (2, -; Hisuian form also phase 2), Cryogonal (1, -), Spiritomb (1, -) | Froslass (1, -, CHUNSOFT) | A snow-maiden that freezes the souls she lures; "Frost Sign: Ice Coffin Lullaby" |
| Shattered Observatory (pre-final) | Lunatone (1, -), Solrock (1, -), Bronzor (1, -), Elgyem (2, -), Beldum (1, -) | Dusknoir (2, -, CHUNSOFT + Caitemis) or Lunala (1, -, baronessfaron) | The gatekeeper of the dead before the eclipse throne; "Gate Sign: Shadow Punch of the Underworld" |

Cosmog (phase 1, **no Shoot**, Emboarger + Yari) fits as a story NPC companion (the "star child" tied to Solgaleo and Lunala). Cosmoem is phase 1 with all Core 6.

## 3. Final boss: Necrozma and fallbacks

| Species / form | Folder | Phase | Core 6 | Extras | Frame size (Idle / Attack) | Credit |
|---|---|---|---|---|---|---|
| Necrozma (base) | `0800` | 1 | All present | Swing, Double, Hop, Rotate (no Strike) | 72x96 / 104x128 | Jhony-Rex + Top_Kec, Deeshura; reworked 2026-09-15 (license column CC_BY-NC_4; older entries PMDCollab_1) |
| Necrozma Dusk Mane | `0800/0001` | 0 | **None, no sprite** | - | AnimData 404 | none |
| Necrozma Dawn Wings | `0800/0002` | 0 | **None, no sprite** | - | AnimData 404 | none |
| Ultra Necrozma | `0800/0003` | 1 | All present | Swing, Double, Hop, Rotate, Rumble, RearUp, Roar | 72x96 / 88x128 | baronessfaron (license column PMDCollab_1) |
| Solgaleo | `0791` | 1 | **Shoot missing** (falls back to Attack) | Strike, Swing, Double, Hop, Rotate | 48x72 / 80x112 | nataniel-sama |
| Lunala | `0792` | 1 | All present | Strike, Swing, Double, Hop, Rotate | 80x96 / 104x136 | baronessfaron |
| Darkrai | `0491` | 2 | All present, plus native Faint | Swing, Double, Hop, Rotate, DeepBreath, SpAttack, Cringe, Float (no Strike) | 40x80 / 80x104 | CHUNSOFT + baronessfaron |
| Darkrai (other forms) | `0491/0001` Cutscene, `/0002` Mega, `/0003` Altcolor, `/0004` Cutscene_Altcolor | 2, 1, 2, 2 | All present | - | not checked | CHUNSOFT / Johanne2 / Darkrai + Audino, Emboarger |
| Giratina (Altered) | `0487` | 1 | All present | Strike, Swing, Double, Hop, Rotate, SpAttack | 56x80 / 72x96 | CHUNSOFT |
| Giratina Origin | `0487/0001` | 1 | All present | Strike, Swing, Double, Hop, Rotate | 80x96 / 96x96 | CHUNSOFT |
| Giratina Altcolor, Origin_Alternate | `0487/0002`, `/0003` | 1 | All present | - | not checked | G〜 / Emmuffin |

Suggested plan with what exists: phase 1 base Necrozma ("Prism Sign: Photon Geyser Eclipse"), phase 2 Necrozma steals the light of Solgaleo and Lunala, shown as Lunala and Solgaleo sprites tinted dark appearing as summons or a dual phase (since Dusk Mane and Dawn Wings do not exist), phase 3 Ultra Necrozma ("Light That Burns the Sky"). Ultra's Rumble, RearUp and Roar sheets give a phase-transition animation for free. Darkrai is the strongest fallback (phase 2, full set, mid-size frames that fit the arena); Giratina gives a two-form fight like Aegislash.

## 4. Gaps and unverified items

| Item | Status |
|---|---|
| Necrozma Dusk Mane, Dawn Wings | No sprite (verified: phase 0, AnimData 404) |
| Amoonguss, Shiinotic, Frillish | No sprite (phase 0, tracker) |
| Jellicent | Incomplete: missing Attack, Shoot, Charge, Hurt (tracker) |
| Shoot missing (fallback to Attack) | Riolu, Lucario (all forms), Solgaleo, Cosmog, Klefki, Mega Absol |
| No Strike sheet (fine unless a move wants Strike) | Absol, Honedge, Aegislash, Necrozma, Darkrai, Koffing, Stunky, Corphish, Litten, Kingambit |
| Native Faint sheet | Only phase-2 species; everyone else uses the Hurt fallback |
| `Shoot` being a `CopyOf` alias | Verified only for the 25 folders spot-checked (Litwick, Trevenant, Sableye are aliases); not checked for the rest |
| Per-sheet license column in `credits.txt` | Verified only for Necrozma base and Ultra |
| Visual fit (does the sprite read well at our zoom, does a form look right) | Not checked; needs a look in game |
| Story notes (isekai, Crimson Eclipse, per-dungeon lore) | Not in `docs/gdd.md`; taken from the task brief |
