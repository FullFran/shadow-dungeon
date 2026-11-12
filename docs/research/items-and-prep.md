# Item gacha, consumables, pre-run preparation and Nightmare difficulty

Research for the owner's request: "luego hay que añadir gacha de objetos y objetos consumibles y demas que te puedas preparar antes de la mazmorra o los desafios... y tal vez subir la dificultad de pesadilla".

Read-only study on `origin/main` at `5c76039` (0.14.0), 2026-11-12. **M** = measured here (command given), **C** = read in code (path:line), **I** = inferred or proposed.

## TL;DR

- Today there are **no consumables and no pre-run preparation**: every in-run item is a held item picked 1-of-3 after a boss, chest or wave room, lost at the end of the run. Pokémonedas only buy permanent upgrades, tutor moves/Mejoras and Pokémon pulls.
- Proposal: a **bag** of 3 consumable slots picked on a third loadout step (species → moves → **bag**), filled from a persistent stock. Stock comes from a fixed-price shop for unlocked kinds plus a **cheap item gacha** that unlocks kinds and pays stock. No real money anywhere, so "pay-to-win" reduces to "grind-to-win"; it is capped by a hard 3-use-per-run bag and by keeping every proof consumable-free.
- **Nightmare, measured:** the run bots (`npm run balance`) cannot tell Hard from Nightmare (both 0 clears out of 10 perfect-bot runs), so they are no use for tuning upwards. The proof table is: Nightmare's median kill margin (**2.33**) is *looser* than Hard's (**2.08**). A Nightmare card is no harder to break than a Hard card; Nightmare just has more cards. The cheapest real lever is to raise Nightmare card segment HP into a margin band of about [1.1, 1.8], plus the elite and heal changes below.

## 1. Audit: what exists today

### 1.1 Held items (in-run, lost at the end)

| What | Where | Notes |
|---|---|---|
| 12 held items, rarity and stack cap | `src/data/items.ts:52-66` | Choice Band, Leftovers, Quick Claw, Sitrus Berry, Scope Lens, Focus Sash, Shell Bell, Muscle Band, Expert Belt, Bright Powder, Wide Lens, Rocky Helmet (C) |
| Hook numbers `ITEM_EFFECTS` | `src/data/items.ts:71-100` | Leftovers 1 %/s; shared sustain ceiling 2 %/s; Sitrus 25 % under 50 % once per stack per floor; Shell Bell 12 % of direct hits within budget; Focus Sash 1/floor; crit ×1.5 (C) |
| Offer: 3 cards, weights common 6 / uncommon 3 / rare 1 | `src/data/items.ts:103-106`, `src/core/items.ts:89-104` | Seeded by run seed, floor and player; capped items never offered (C) |
| Stat pipeline and hooks | `src/core/items.ts:49-71` (`playerStats`), `:129` (Shell Bell), `:146` (Focus Sash), `:185` (Leftovers, Sitrus) | Upgrades fold in through the same `playerStats` (C) |
| When a pick happens | `src/core/run.ts:194-202` (`bossPickDue`, `withRewardOffer`), `src/app/game.ts:1106-1113` (`watchBossPick`) | After each boss if the run goes on; never after the last guardian; never in Shrine trials (`trial` guard, `game.ts:1107`) (C) |
| Chest and wave rooms | `src/core/sima-events.ts:477-480` | Same offer, other salt (C) |
| Pick overlay | `src/app/item-pick.ts:7-40` | 1/2/3 or click; solo pauses, shared run does not (C) |
| Sableye steals the last item | `src/core/stolen.ts:14-18` | Comes back when the thief falls (C) |
| Run resume stores items | `src/app/run-resume.ts:134` | Validated against `ITEMS` ids (C) |

### 1.2 Oran Berries and floor heal

| What | Where | Notes |
|---|---|---|
| 35 % per non-start room, heals 20 HP, seeded | `src/data/items.ts:113-120`, `src/core/berries.ts:22-30` | Host-authoritative claims in co-op (`berries.ts:8-17`) (C) |
| Floor-entry heal 25 % + Respite upgrade | `src/data/upgrades.ts:26-27`, GDD §6 table | (C) |
| Spell-card capture heals 12 % and pays 8 P | `src/data/cards.ts:114` | (C) |

### 1.3 Pokémonedas: sources and sinks

| Source | Where | Value |
|---|---|---|
| Floor cleared | `src/data/coins.ts:12` | 6 × depth |
| Enemy | `src/data/coins.ts:18-19` | 1.65 × (1 + 0.5 (depth − 1)) |
| Collapse escape | `src/data/coins.ts:21-25` | 20 / 12 / 6 |
| Guardian / mid-boss / card capture | `src/data/coins.ts:27-29`, `src/data/cards.ts:114` | 50 / 25 / 8 |
| Per minute | `src/data/coins.ts:31` | 2 |
| Defeat keeps | `src/data/coins.ts:33` | 75 % |
| Tier multiplier | `src/data/difficulty.ts:80-84` | Easy 1, Normal 1.3, Hard 1.7, Nightmare 2.2 |
| Challenge (Shrine) first clear | GDD §3 Santuario | 150 / 300 once per tier |
| Merchant (in-run spend) | `src/data/sima.ts:212`, `:250`; `src/app/game.ts:903-916` | Sima: berry 8, item 20; other dungeons: 12 and 30, paid from the run's coins in hand (`simaSpent`, `game.ts:606`) |

Per run (I, from the GDD's "a full Crypt victory pays about 165" × tier): Easy ≈ 165, Normal ≈ 215, Hard ≈ 280, Nightmare ≈ 365.

| Sink | Where | Cost |
|---|---|---|
| Permanent upgrades (5) | `src/data/upgrades.ts:21-32` | about 5,000 in total (GDD §11), finite |
| Tutor moves and Mejoras | `src/data/tutor.ts:103-124` | priced by tier/slot/power, finite |
| Pokémon gacha | `src/data/gacha.ts:19` | 100 per pull; duplicate refunds 40 |

**Finding (I):** every sink is finite. Once a player owns the roster and maxes upgrades, Pokémonedas have no use. A consumable stock is the first **renewable** sink, and that is its main economic value.

### 1.4 Pokémon gacha (the pattern to reuse)

- Pure, seeded pull `src/core/gacha.ts:23-46`: rarity roll, pick roll, shiny roll in that fixed order (so old seeds keep their species), pity counters `pity` / `shinyPity` in the save.
- Table `src/data/gacha.ts:19`: cost 100, rare 15 %, hard pity 10, duplicate refund 40, shiny 2.5 %, shiny pity 80.
- Page `/gacha` (`src/app/gacha-page.ts`), Mimikyu's stall in town (GDD §5).

### 1.5 Save, cloud, net

| What | Where | Notes |
|---|---|---|
| Save v4, optional-field additions without a bump | `src/app/save.ts:31-41` (history), `:43-75` (`SaveData`) | Precedent: shinies, gender and story were added "same version, optional fields only" |
| `migrate` / `sanitize` | `src/app/save.ts:87`, `:97-130` | Unknown keys dropped; whole non-negative numbers |
| Cloud payload: save flat at top level | `src/app/cloud-payload.ts:1-28` | Server checks only `version`, whole `coins` and a 64 KB cap (`server/internal/rules/rules.go:51-75`) |
| Profile merge rules per field | `src/app/profile-merge.ts:14-29` (`SAVE_FIELD_RULES`) | "Economy is never merged"; a new `SaveData` field fails typecheck until it gets a rule |
| Co-op: items are per peer, not on the wire | `src/core/state.ts:176-177`; coins tallied per peer (`src/core/coins.ts:5-12`) | Only item **ids** enter the content hash (`src/net/version.ts:2-14`, `PROTOCOL_VERSION = 5`) |
| Co-op revive, none on Nightmare | `src/core/revive.ts:29`, `src/data/difficulty.ts:84` (`coopRevive: false`) | |

### 1.6 Pre-run screens and inputs

- Loadout: two stages, species then moves (`src/app/loadout.ts:17-30`). The Shrine reuses it (`src/app/shrine-route.ts:23-24`, `:44-54`) and its trials are "without items or shop upgrades" by design (GDD §3 Santuario, Reflejos).
- Keyboard defaults (`src/adapters/bindings.ts:68-85`): Q/E/R/F + 1/2 slots, Shift lock/run, Tab map, M mute, E interact. `G`, `C`, `X`, `Z`, `3` are free in a run (I: not in the table).
- Pad combat frame (`src/adapters/gamepad.ts:98-118`): X/Y/LB/RB slots, A roll, LT/R3 lock, d-pad left/right swipe. **RT and d-pad up/down look unused in combat** (I: verify with a test before using them).
- Touch: slot buttons in `src/adapters/touch-slots.ts`.

## 2. Design proposals

### 2.1 Consumables (the base everything else rests on)

Design rules (I):
1. **Using one takes time.** A short use animation (about 500 ms, rooted, cancelled by a roll, lost if hit) to fit real-time combat. The safe moment is the boss's "tu turno" (`TierDef.turnMs`, `src/data/difficulty.ts:76`), so the turn system gets one more use.
2. **Few per run.** A bag of **3 slots**, one consumable each (stack of 1, two for the cheapest heal). Nothing is found inside runs at first, so the bag is the whole budget.
3. **No consumable breaks a card.** Damage boosts still hit `CARD_FLOOR` (no break before 35 % of the timer, GDD §9 rule 9). A bullet clear forfeits that card's capture. Proofs never use the bag (§4).

| Id (code) | Working name es / en | Effect | Kind | Note |
|---|---|---|---|---|
| `dew-tonic` | Tónico de rocío / Dew Tonic | Heals 30 % max HP over 1 s (stops if hit) | heal | Stack 2; the staple |
| `clear-salt` | Sal clara / Clear Salt | Cures every affliction (`src/core/afflictions.ts`), 4 s immunity | cure | Swamp/poison counter |
| `ember-dust` | Polvo de brasa / Ember Dust | +20 % damage for 20 s | boost | Bounded by `CARD_FLOOR` |
| `wind-feather` | Pluma de viento / Wind Feather | Stamina regen ×1.5 for 20 s | boost | Dodge-heavy cards |
| `hush-lantern` | Farol de calma / Hush Lantern | Fades every enemy shot on screen (like the 350 ms "tu turno" fade) | bomb | Forfeits the current card's capture; 1 per bag |
| `spore-bomb` | Bomba de esporas / Spore Bomb | Thrown; stuns normal enemies 2 s in a radius; minor damage to bosses | bomb | Bosses: no stun |
| `second-sprout` | Brote de aliento / Second Sprout | Auto: on fainting, stand up with 35 % HP; co-op: use on a fallen ally in reach to revive at once | revive | 1 per run; tier rule is a decision (§6 Q3) |
| `exit-cord` | Cordón de vuelta / Return Cord | Leave the run keeping 100 % of the coins (instead of 75 % on defeat) | escape | Not in boss arenas, Shrine or co-op guest |
| `fog-lamp` | Lámpara de bruma / Mist Lamp | Reveals the floor map and berries | utility | Fog floors (Misty Forest) |

All names are original working names; final copy goes to `src/i18n/es.json` and `en.json`. Sprites: new pixel icons in our own style (pixel-craft), no external art.

**Input (I):**

| Device | Use selected | Cycle selection |
|---|---|---|
| Keyboard/mouse | `G` (new `BindAction` `item`, rebindable via `bindings.ts`) | `C`, or mouse wheel |
| Pad | RT | d-pad up/down |
| Touch | A bag button above the slot cluster: tap uses the selected item, long-press opens a 3-slot fan |

The HUD shows the 3 slots near the move slots with counts; the Esc menu lists the bag with descriptions (it already does this for held items).

**Co-op (I):** the bag is per peer, like held items and coins. Self effects (heal, cure, boost) run on the user's peer (victim side, like damage). Effects on enemies (spore bomb) go through the existing `hitClaim` path (`src/core/items.ts:173-177` is the Rocky Helmet precedent). The lantern needs one new host-authoritative event (the host fades shots and the snapshot carries the result). The sprout on an ally reuses the revive state the fallen peer already owns (`src/core/revive.ts:6-16`). Adding consumable ids to the content hash and one event means a `PROTOCOL_VERSION` bump (`src/net/version.ts:14`).

### 2.2 Item gacha

| Aspect | Proposal (I) |
|---|---|
| Place | A second stall in the Refugio and a tab on the `/gacha` page (same pure-pull pattern as `src/core/gacha.ts`) |
| Cost | 50 P per pull (half a Pokémon pull: it is a renewable sink, not a jackpot) |
| Common (75 %) | 2-3 units of an **unlocked** common consumable (tonic, salt, feather) |
| Uncommon (22 %) | 1-2 units of boost/bomb/lamp; unlocks the kind if new |
| Rare (3 %) | Unlocks a rare kind (sprout, lantern, cord) + 1 unit; or a cosmetic **bag skin** once all are unlocked |
| Pity | Uncommon or better guaranteed by pull 5; rare guaranteed by pull 30 (own counters, like `pity` / `shinyPity`) |
| Duplicates | Stock only; units are capped at 9 per kind; over the cap they refund 10 P each |
| Anti pay-to-win | No real money exists; every kind, once unlocked, is also sold at a **fixed price** in Poochyena's shop (tonic 20, salt 20, feather/dust 35, bomb/lamp 40, sprout/lantern/cord 80), so the gacha is a discount and a discovery path, not the only door. The bag cap (3) bounds what any amount of stock can buy in a run |

Why unlock-by-gacha plus shop (I): the gacha gives the "new thing" moment; the shop prevents bad luck from gating a build. A "gacha only" model would make bad pulls feel like lost power.

### 2.3 Pre-run preparation (bag step)

- **Loadout gets a third stage `bag`**: species → moves → bag → Start (`src/app/loadout.ts` `stage` union, `src/app/shrine-route.ts` steps). Three slots, a grid of owned stock, the last bag remembered in settings (like `loadouts`). Skippable: Start with an empty bag stays one press away.
- Stock is **spent when used, not when packed**: unused units go back to stock at the run's end (victory, defeat or quit). This keeps the step low-anxiety; the decision is "what do I bring", not "what do I risk".

| Mode | Bag | Why (I) |
|---|---|---|
| Main dungeons, all tiers | Yes | The core use |
| Sendas / challenges (`CHALLENGES`, `src/data/dungeons.ts:647-656`) | Yes | Same flow as a run |
| Sima (endless) | Yes; the merchant also sells tonics at Sima prices | Merchant already spends run coins (`game.ts:903-916`) |
| Shrine reflections and gauntlets | **No** (recommended) | They are deliberately "without items or upgrades" (GDD §3); records stay comparable |
| Co-op | Each player packs their own on their own loadout / "Listo" step | Nothing travels except effects |

### 2.4 Save, migration, sync

| Field (optional, save stays v4 like shinies/gender/story) | Type | Sanitize |
|---|---|---|
| `stock?` | `Partial<Record<ConsumableId, number>>` | Known ids only; whole numbers, clamped 0..9 |
| `unlockedConsumables?` | `ConsumableId[]` | Known ids, unique |
| `itemPity?`, `itemRarePity?` | number | `wholeCount` like `pity` |
| `bagSkins?` / `bagSkin?` | ids | Subset rule like `shinyWorn` ⊂ `shinies` |
| Settings: `bag` (last packed) | `ConsumableId[]` (≤ 3) | Not in the save: settings key, like `loadout` |
| Run resume: bag left | in the resume record (`src/app/run-resume.ts:134` pattern) | Validate ids against the table |

- `migrate` needs no step (absent = none). `sanitize` gets the clamps above.
- Cloud: flat top-level keys, a few hundred bytes, well under 60 KB (`src/app/cloud-payload.ts:17-18`); the server needs no change (`rules.go:51-75`).
- `profile-merge.ts`: `stock`, pities and the gacha counters are **economy** (never merged: the kept profile wins, same as `coins`); `unlockedConsumables` and skins may be **merged** (union), like achievements. Typecheck forces this choice (`SAVE_FIELD_RULES`).

## 3. Nightmare difficulty

### 3.1 What Nightmare is today (C)

`src/data/difficulty.ts:84`: enemy HP ×1.45, damage ×1.5, telegraph ×0.85 (floored, `:93-121`), cooldowns ×0.7, elites 30 % (only `tough`/`frenzied`, `:174`), no floor restart, no bonfire respawn, no co-op revive, encounters ×2 +1 wave, roll i-frames ×0.8 / stamina ×1.2, "tu turno" 800 ms (floor 700, `:93`), coins ×2.2. One hit never takes more than 35 % of reference HP (`MAX_HIT_SHARE`, `:114`).

### 3.2 Measurements

**Run bots** (M: `npx vite-node tools/balance.ts --quick --tier=<t> --out=<tmp>`, seeds 1-2, solo, default Mimikyu loadout; and `--slots --full=zorua --ranks=2` for full investment). Clears out of 10 runs (5 dungeons × 2 seeds):

| Tier | perfect bot clears | average bot | perfect bot, isolated boss arenas felled (of 9) | full-investment Zorua: arenas felled |
|---|---|---|---|---|
| Normal | 3/10 | 3/10 | n/a | n/a |
| Hard | 2/10 | 0/10 | 1/9 (Sableye only) | 1/9 |
| Nightmare | 0/10 | 0/10 | 0/9 | 1/9 |

Reading (I): the bots **saturate** at Hard. They die at the first card boss on both tiers, so their clear rate cannot rank Hard against Nightmare or show whether a change made Nightmare harder for a human. The committed `reports/balance/latest.md` is from 2026-10-26 (stale). Bot calibration: the GDD's human-time factor is about ×1.9 (§9 rule 9), so humans who pass Nightmare are far stronger than these bots.

**Beatability proof** (M: `npx vite-node tools/prove.ts --judge`: 166/166 cards survivable, 24/24 Nightmare solver fights cleared in 33 s; `reports/proof/latest.md` unchanged). Kill margin = timer / estimated time to break the card for the worst starter at the expected level, with no items or upgrades (`src/sim/prove.ts:62-63`: targets Normal 1.5, Hard 1.3, Nightmare 1.1):

| Tier | cards | survival cards | known gaps (0 melee windows) | median margin | p25 | min | cards < 1.3 | median melee window |
|---|---|---|---|---|---|---|---|---|
| Normal | 43 | 0 | 4 | 2.44 | 1.75 | 1.56 | 0 | 4.7 s |
| Hard | 53 | 10 | 9 | **2.08** | 1.46 | 1.33 | 0 | 4.65 s |
| Nightmare | 70 | 10 | 10 | **2.33** | 1.57 | 1.13 | 11 | 4.35 s |

Reading (M+I): Nightmare adds 17 cards, but its **typical card is easier to break than Hard's** (median 2.33 against 2.08). Its target (1.1) is much lower than what most cards reach, so the tier's damage pressure sits mostly in the extra cards and the 800 ms turn. A human with upgrades, Mejoras and held items is above the reference player, so in play the margins are even looser.

### 3.3 Proposed changes (each keeps the proof green)

| # | Change | Where | Expected effect (I) | Proof check |
|---|---|---|---|---|
| N1 | **Card HP band**: per-card Nightmare segment HP so the margin lands in [1.1, 1.8] (scale cards above 1.8 down to it; leave those under it alone) | card data, the same per-card factors already used for Zorua (GDD §9 rule 9) | Median margin from 2.33 to about 1.6: Nightmare breaks become tighter than Hard's, without new patterns | `npm run prove` margin column ≥ 1.1 for every card; known-gap list does not grow |
| N2 | **All six elite traits on Nightmare** (swift, volley, armored, enrage join tough/frenzied) | `src/data/difficulty.ts:174` (tier rule) | Behaviour over numbers (GDD §9 rule 2); elites read at a glance | Generated floors only; telegraph floor still applies (`effectiveTelegraphMs`) |
| N3 | **Less free healing**: floor-entry heal 25 % → 15 %, Oran Berry chance 35 % → 20 %, item sustain ceiling 2 %/s → 1.5 %/s, on Nightmare only | `src/data/items.ts:79`, `:115`; floor heal | Attrition across floors matters; consumables become the planned heal | Proof unaffected (cards start at full HP, no items) |
| N4 | "Tu turno" 800 → 700 ms (its floor) | `src/data/difficulty.ts:84` | Fewer free hits per turn, about −12 % punish time | Re-run prove: margins drop roughly in proportion; re-check the 11 cards already < 1.3 |
| N5 | Rewards: coins ×2.2 → ×2.5, and a Nightmare clear guarantees one uncommon item-gacha pull (or 1 rare unit) | `src/data/difficulty.ts:84`, new reward | Keeps "harder pays more" (GDD §9 rule 8) honest after N1-N4 | n/a |

Not proposed (I): more enemy HP than ×1.45 (GDD §9 rule 2 caps it), more enemies per room (rule 3), shorter telegraphs (rule 1 floors). Damage above ×1.5 is mostly absorbed by `MAX_HIT_SHARE`, so it buys little.

Validation plan: first make the run bots useful above Normal (e.g. `--ranks=2 --build` plus starting levels at `expectedLevel`), or replace "clear rate" with the solver's punish/margin columns as the Nightmare gate. Then diff `prove` before and after N1/N4.

## 4. Consumables against balance and proofs

| Rule | How (I) |
|---|---|
| Proofs never use consumables | Proof worlds are built with `createWorld` and no items (`src/sim/prove.ts:103`, `:656`); keep the bag empty there and add a test that asserts it, like the "no items or upgrades" reference player (GDD §9 rule 6) |
| No consumable skips a card | Damage boosts stop at `CARD_FLOOR`; the lantern fades shots once and forfeits capture; spore bombs do not stun bosses |
| Healing is bounded per run | Bag of 3 × at most 30 % ≈ 90 % max HP per run in the worst case; Nightmare N3 lowers free healing by about the same amount, so the total stays near today's |
| Revive cannot undo a tier rule silently | `second-sprout` follows the owner's choice (§6 Q3); never more than 1 per run |
| The harness measures it | Add `bag?: ConsumableId[]` to the runner options, next to `items` (`src/sim/runner.ts:65-66`, `:130`), with a bot policy (heal under 40 %, lantern on a card with < 30 % HP); report clears with and without the bag; band: a perfect bot with a full bag still does not break any card before its floor |

## 5. Parity checklist (integration rule)

- Every playable species: bag works for all (no species-specific consumable); test iterates `PLAYABLE_SPECIES`.
- Every dungeon: main dungeons, `CHALLENGES`/Sendas, Sima (bag + merchant tonics); Shrine per decision; test iterates `DUNGEONS` + `CHALLENGES`.
- Every boss: lantern/boost rules verified per boss card in a test (no break before the floor).
- Solo and co-op: per-peer bag; host-authoritative lantern; sprout on ally; `PROTOCOL_VERSION` bump; content hash includes consumable ids.
- Save/migrate/sanitize, profile-merge rules, cloud payload, run resume.
- i18n es/en for names, descriptions, the bag step, the stall; GDD §3, §6, §9, §11 updates (Spanish).
- Sim/prove: runner `bag` option, proof-no-bag test, balance report columns.
- Input: new rebindable `item` action (keyboard, pad, touch), the key-bindings panel and device hints (`src/ui/device-hint.ts`).
- Art: icons for every consumable and bag skins, in our own pixel style.

## 6. Decisions for the owner

1. **Where do consumables come from?** (a) Gacha unlocks kinds + fixed-price shop for unlocked kinds; (b) gacha only; (c) shop only, no item gacha. **Recommended: (a)**: the gacha gives the reveal, the shop removes bad luck.
2. **What happens to the bag at the end of a run?** (a) Only used units are spent, the rest returns to stock; (b) a defeat loses the whole bag (Mystery Dungeon style); (c) everything packed is spent. **Recommended: (a)**: low anxiety; the bag cap already limits power.
3. **The revive consumable on Nightmare and co-op?** (a) Allowed everywhere, 1 per run; (b) allowed except on Nightmare; (c) only to revive an ally (co-op), never yourself. **Recommended: (b)**: Nightmare's "no revive" identity stays intact.
4. **Bag in the Shrine?** (a) No bag (trials stay "no items, no upgrades"); (b) bag allowed, records marked "with bag"; (c) bag allowed freely. **Recommended: (a)**.
5. **How to make Nightmare harder?** (a) Tighten what exists: card HP band N1, elites N2, less free healing N3, turn 700 ms N4, rewards N5; (b) only numbers (damage and HP up); (c) keep Nightmare and add opt-in named modifiers on top. **Recommended: (a)**: measurable with the proof and consistent with GDD §9 rules 1-3; (c) can come later.
