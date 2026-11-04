# DESIGN.md — Mazmorra Sombría

## 1. Intent & North Star

**"Relic of the Eclipse."** A souls-like hub under a dead sun: carved obsidian slabs edged in old gold, embers
for focus, crimson for danger, bone-white text. Every surface should feel like a relic found in a ruined
crypt: heavy, quiet, a little warm where the eclipse light touches it. Pokémon live in the scene (silhouettes
on ruins, the player's partner on an altar), never as stickers on a flat background.

- Voice: sober, short, a hint of myth ("Desciende", "El eclipse aguarda"). Player-facing text in peninsular Spanish (es) and English (en).
- Layout references (patterns only, no assets): PokéIsaac and PokéSurvivor hubs: icon rails round the screen,
  featured partner in the middle, one dominant Play, currency chips on top.
- Tone references (patterns only): Dark Souls 3 / Nightreign menus: thin gilt frames, dark stone, sparse glow.
- Anti-references: cartoon yellow buttons, purple glassmorphism, flat blue Mystery Dungeon windows (superseded,
  see Decision Log), emoji icons, line icons in a single stroke colour on the hub.

## 2. Tokens

Source of truth: `src/ui/tokens.ts` (`PALETTE`, `RELIC`), emitted as `--md-*` CSS custom properties.

Colour (role):
| Token | Hex | Role |
|---|---|---|
| ink | #050407 | page, darkest outline |
| windowTop / windowBottom | #1f171d / #0c090d | slab fill gradient (every window) |
| border | #c9a45a | old-gold frame line |
| borderShade | #5c4526 | inner bevel line |
| text | #efe6d6 | bone, body text |
| textDim | #b3a690 | secondary text |
| disabled | #8f8489 | locked / unavailable (5.26:1 on the slab) |
| cursor | #ffbf5e | focus, selected values (ember gold) |
| eclipse / eclipseGlow | #e8283a / #ff6a3d | titles, danger, the sun |
| relic.ember | #ff8a3d | Play glow, focus halo |
| relic.blood | #9e1b2a | badges, warnings |
| relic.slab | #140f14 | rail and chip fill |

Typography: Pixelify Sans (labels, titles, HUD; sizes on the 11 px grid), Atkinson Hyperlegible (reading text, inputs).
Spacing: 4 px base; hub gutters 16 px (phone) / 24 px (desktop). Radius: 6 px slabs, 4 px chips (stone is not round).
Elevation: hard drop shadow `0 6px 0 rgba(0,0,0,.5)` + gold hairline; glow only on focus and Play.
Z-index: backdrop 0, hub 2, overlays (town windows) 20, toasts 30.

## 3. Layout Primitives

Title hub, CSS grid over the full viewport:
- top row: profile plate (left) · logo (centre) · chips and system buttons (right)
- middle: left rail (partner services) · altar with the partner (centre) · right rail (world services)
- bottom: news card (left) · JUGAR + online (centre) · small links (right)
Breakpoints: `html.touch` and `max-height: 520px` compress rails to icon-only columns with 44 px targets.

## 4. Component Patterns

- **Relic button** (`.hub-btn`): 56 px square slab, colour pixel icon 32 px, label under it. States: rest, hover/focus
  (gold frame + ember halo), locked (desaturated icon + padlock pip, still focusable, explains why), badge (blood pip).
- **Play slab** (`.hub-play`): the only ember element; 72 px tall; label + one line on where it leads.
- **Chip** (`.hub-chip`): pixel icon + tabular number on a slab.
- **Overlay** (`.town-shop`): service windows open over a darkened, blurred-free vignette of the scene (system notices are the one scoped exception: they blur; see System notice and the 2026-11-04 decision).
- **Pixel icons** (`src/ui/pixel-icons.ts`): 16×16 maps, 3–6 colours each, rendered as crisp SVG rects. Every
  service has one; line glyphs (`glyphSvg`) remain only on the inked town plan.

- **System notice** (`src/ui/notice.ts`, pure model `src/ui/notice-model.ts`, notices as data `src/pwa/notices.ts`, `src/styles/system-notice.css`; owner
  2026-11-04 "con el fondo blur oscurecido, arriba y más grande para darle más prioridad visual"): one component for every notice the game
  raises about itself: update ("Nueva versión disponible"), install ("Lleva la mazmorra contigo") and news ("Novedades de la versión"). A full-viewport
  veil (ink 60% + `backdrop-filter: blur(6px)`; solid ink 88% where blur is unsupported or `prefers-reduced-transparency`) and one relic slab anchored top
  centre, `min(640px, 92vw)`, gilt frame: 48 px pixel icon (install crystal, update rune stone, news scroll), title Pixelify 33 px (28 px under 560 px of
  height), up to three lines in Atkinson 17 px each with a 24 px pixel icon, then big relic buttons (52 px): one ember primary (Instalar / Actualizar
  ahora / Ver novedades), one quiet secondary (Ahora no / Más tarde) and, only where it exists, the "No volver a mostrar" text link (44 px target).
  Behaviour: one at a time, priority update > install > news (`NOTICE_PRIORITY`), shown only on the hub (never in a run, the town, a service window
  or the drawer) and never while `setNoticesBlocked(true)` (the first-run welcome toggles it through the `sd:notices-blocked` event). The page behind is
  `inert`, focus is trapped in the card, Enter is the primary, Esc the secondary, a press on the veil is the secondary for install and news only; the update
  is never closed by a veil press and its primary keeps the card up until the page reloads (no half state). "Más tarde" on the update puts it off 10 minutes.
  Entrance: veil fades 160 ms, card drops 24 px in 220 ms ease-out; under `prefers-reduced-motion` both only fade (`noticeMotion`). Reason: a system
  message must out-rank the hub (Von Restorff) without a timer or fake urgency. Dev check: `?notice=install,update,news` on the dev server. Contrast
  computed by hand on the slab base (design-gates script not run): text 15.3:1, quiet label and link 7.92:1, primary label on blood 6.41:1. Replaces the
  bottom-left install card (`.pwa-card`) and the bottom update toast (`.pwa-toast`); the news no longer replaces the hub on boot.
- **Partner altar** (`src/app/title-hub-view.ts`, `src/ui/altar-art.ts`, `src/app/partner-plate.ts`, `src/styles/hub-altar.css`; owner 2026-11-04
  "presenta mejor a tu pokemon"): the hub's focal point (Von Restorff; JUGAR stays the only ember CTA). The partner stands on a carved
  eclipse-stone altar (three stepped drums, pixel art on a 128×54 cell grid with palette keys, drawn once and scaled by a whole number
  `--k`: 3 on desktop, 1 on short or narrow screens), the eclipse corona behind it (a dark disc ringed red, a slow 4.2 s breath in opacity
  and scale), ember light from below (a warm pool under the altar, four embers rising) and the idle animation of its own sprite. The
  partner is a `sprite-box` (250×214 desktop, 200×164 under 800 px of height, 170×138 under 740, 100×62 compact) standing on the middle of
  the top face, never clipped. Nameplate = a stone tablet hung from the altar's front with a gilt stud: kicker "Tu compañero", name
  (Pixelify 38/30/28 px), type chips (the type colours of `.type-badge`), the Senda bond chip only when a chapter is closed, the passive
  on one line (description as tooltip) and "Cambiar" as a relic button (>= 44 px, Pokémon icon, gilt frame, ember halo on focus).
  Compact (max-height 560 px or max-width 900 px): the plate is one row, name and chips left, the 44 px icon button right (its name stays
  as `aria-label`). Only transform and opacity animate; none of it moves under `prefers-reduced-motion`. The backdrop shows the town alone:
  no wandering Pokémon (Mimikyu and Gastly were removed, `src/ui/town-walkers.ts` is gone). Measured at 1920×1080, 1440×900, 1366×768,
  1280×720 and 844×390: no overlap with the logo, rails, news, JUGAR, online, links or profile plate (gap to JUGAR 122, 32, 23, 19 and 12 px).
- **Face avatar** (`facePortrait` in `src/adapters/portrait.ts`, `src/data/portraits.ts`, `src/styles/face-portrait.css`; owner 2026-11-04
  "un avatar custom con la cara del pokémon, no el sprite repetido"): an identity is a face, not the walking sprite. The PMDCollab "Normal"
  portrait (40×40, CC BY-NC 4.0, `tools/fetch-portraits.mjs` pins the SpriteCollab commit in `src/data/portrait-meta.json`, files in
  `public/portraits/<sprite key>/Normal.png`, credits in CREDITS.md) is drawn crisp (`image-rendering: pixelated`) in a relic frame: gilt
  ring, ink bevel, the species' first type colour as the inner edge, an ember vignette. It follows the shiny and female look of the
  partner; a look without art of its own falls back to the base portrait of the form (`portraitFor` says `own` or `fallback`), and a
  missing file or no portrait at all to the head cropped from the idle frame, never a broken image. Used in the hub profile plate (60 px,
  40 px compact) and the signed-in account drawer (48 px). Not used where the scene needs the creature (pause summary, dialogue, end
  screens keep their `sprite-box`). Friends and co-op frames do not carry a species yet (the server's friends list has no avatar field):
  pending.
- **Side drawer** (`.drawer-veil` + `.ad-drawer`, `src/app/account-drawer.ts`): the quick-entry pattern for short forms and
  account state (owner, 2026-11-04). A full-height relic slab (400 px, 100% under 520 px) slides in from the right over a
  darkened scene; click outside and Esc close it (`ui/dismiss.ts`), focus is trapped, arrows/Tab move through the controls,
  Enter acts. Order top to bottom: why in one line, providers, divider, form, the one ember call to action, the guest
  choice as an equal block (at most three facts per side, no pressure). In a short landscape window (max-height 520 px)
  the two halves sit side by side. Slide 160 ms ease-out (the panel comes from the edge it lives on); none under
  `prefers-reduced-motion`. Pending shows at once, errors stay inline. Shared controls: `src/styles/relic-controls.css`.
- **Friends window** (`src/app/friends-window.ts`): the picker pattern applied to a social list: a sheet (your code, add by
  code) beside a column of cards (avatar tile with a diamond state pip, name, state line, actions). Signed out it is one
  compact card that opens the drawer.
- **Accordion list** (`src/app/tutor-screen.ts`, `src/app/tutor-groups.ts`, `src/styles/tutor.css`): one column of groups
  scrolling inside its own region (styled scrollbar, never the page). Header = real `<button>` with `aria-expanded` and
  `aria-controls`, 48 px tall: chevron, category pixel icon, name, count, how many are at max rank. Body = `role="region"`
  labelled by its header, `inert` while closed. One group open on arrival (Miller), the rest closed (Hick). Rows are
  calm (≥ 44 px): name, rank pips, one quiet state at the right; the single ember is the focused row's payable state
  (Von Restorff). Keys: Up/Down walk headers and open rows, Left/Right fold/unfold (Left on a row climbs to its header),
  Enter/Space on a header toggles. Expand 140 ms (`grid-template-rows` 0fr to 1fr), none under `prefers-reduced-motion`.
  Category tabs are dropped when the groups are the filter (two controls for one job is clutter).
- **Hint bar** (`.ph`, `src/ui/play-hints.ts`, `src/ui/play-hints-model.ts`, `src/styles/play-hints.css`): relic chips (slab fill,
  slab-edge frame, 4 px radius, hard drop) along the bottom edge, in the free stretch between the message log and the move slots
  so it never covers the player or HUD. Each chip is the glyph of the last device used (square pixel keycaps for the keyboard,
  the pad glyphs of the controller help for xbox/playstation) plus a label; at most six. Sizes come from the window height
  (`hintSizes`, owner 2026-11-04 "más grande las ayudas visuales"): desktop chip >= 40 px (42 mid, 48 tall), keycap >= 28 px,
  label >= 16 px; under 540 px of height 34 / 24 / 14 so it keeps clear of the HUD. It no longer carries the interact action (the
  World tooltip does). Touch hides it. Shows 5 s after the context changes, then fades 400 ms (none under `prefers-reduced-motion`);
  labels step back (move and attack first, then all) when the stretch is narrow. Fullscreen toggle button (pixel icon, same height as
  a chip) at its end, always faint; F11 and Alt+Enter too. Setting: Settings, Accessibility, "Ayudas de control". Bindings come from
  `src/adapters/bindings.ts`.
- **World tooltip** (`.wt`, `src/ui/world-tooltip.ts`, pure model `src/ui/world-tooltip-model.ts`, `src/styles/world-tooltip.css`; owner
  2026-11-04 "cuando haya que interactuar, que salga como tooltip cerca de lo que vas a hacer"): the interact prompt. One relic chip with
  a gilt diamond pointer, anchored over the single target `interact` would pick (the same `nearestInteractable` call), never two (Selective
  Attention). Content: the device glyph (E keycap, the pad's confirm button; on touch none, the chip is the button, >= 52 px) and the
  verb of the real interaction kind (`interactKind`: Hablar, Leer, Viajar, Entrar, Comprar, Aprender, Probar suerte, Evolucionar,
  Encender). Placement (`placeTooltip`): above the target and centred, clamped to the screen with an 8 px margin, below it when
  there is no room above, slid sideways past the player's sprite box when that is what stands in the way: never over the player, never
  over the target. Follows the target every frame (CSS px from the world position and the zoom). Rises 6 px in 120 ms (Doherty); none
  under `prefers-reduced-motion`. Replaces the interact chip of the hint bar and the floating canvas text.
- **Dialogue box** (`.db`, `src/ui/dialogue-box.ts`, model `dialogueView` in `src/town/dialog.ts`, sources in `src/town/dialogue-sources.ts`,
  `src/styles/dialogue-box.css`; owner 2026-11-04 "rediseña también los diálogos"): a relic slab at the bottom edge (max 980 px) for every
  line the town speaks (villagers, signs and statues, the board, the beacon, the pleas, the tour guide). Left, the speaker's portrait in a
  120 px `sprite-box` (the Sprite fit rule: whole creature, cropped to what the idle animation covers, never clipped); none for signs.
  A name plate sits on the slab's top edge. Body: Atkinson Hyperlegible 20 px (18 px under 520 px of height), line height 1.5, three lines
  of room reserved so the box never jumps while it types. Typewriter at 40 characters per second; a press completes the page, the next
  one moves on; instant under `prefers-reduced-motion` (`openDialog(lines, true)`). Foot: page counter "n / N" only when there are
  several pages, and the continue button (>= 44 px: device glyph + "Continuar"/"Cerrar" on the last page), dimmed until the page is
  complete, then ember with a stepped arrow (bobs only without reduced motion). A click or tap on the slab advances. Choices: none exist
  inside a dialogue today (the oracle's answer is a window), so none are drawn; add them as relic buttons with the shared window navigation
  when one appears.
- **Creature scale** (`src/adapters/creature-scale.ts`, `CREATURE_SCALE = 1.5`; owner 2026-11-04 "Haz los pokemon también más grandes"): every
  Pokémon in the world (player, remote players, enemies, bosses, clones, figurations, town villagers, walkers and co-op walkers) is drawn at
  1.5x, nearest-neighbour, around its feet. Visual only: hitbox radius, collision, lock-on, AI ranges, telegraphs and network state never read it.
  Shadows, name tags, aura rings, marks and status icons scale with `withCreatureScale`; a herald or wound factor multiplies it, so bosses keep
  their relative size. Why 1.5: frames are 24-56 px against 32 px tiles; 1.5 makes the common 32x48 frame 48x72 and keeps 3 device pixels per
  source pixel at the 2x desktop zoom (crisp); 2x would tower over house doors.
- **Sprite fit rule** (`src/ui/sprite-fit.ts`, `src/styles/sprite-fit.css`): a Pokémon is never cropped. Its box has a
  fixed size and the class `sprite-box`; the canvas fills the box (`object-fit: contain`, bottom-centred) and, inside a
  `sprite-box`, is cropped to the pixels the idle animation really covers (`portrait()` in `src/app/loadout.ts`), so the
  box fits the creature itself and reserves its headroom. Forbidden: `overflow: hidden` on a sprite box, negative
  `margin-bottom` or a fixed `height: Npx !important` on a sprite canvas, scaling a whole stage with `transform`.
  Every box is declared in `SPRITE_BOXES`; `tests/ui/sprite-fit.test.ts` fits every playable species (base, shiny,
  female sheets) and every shrine boss in every box and checks the stylesheet agrees.

- **Pause window** (`src/app/pause-view.ts`, `src/app/pause-model.ts`, `src/app/pause-map.ts`, `src/styles/pause.css`): one centred relic
  window over the dimmed, frozen run (one veil of 52-64% ink: the room, the player and the HUD stay readable behind it; a confirm opened over it
  adds no second veil of its own; the overlay is a `no-dismiss` veil: a press outside does nothing, so a stray click never resumes a
  run or reaches an action). Three fixed columns, no page scroll: actions (slab rows ≥ 44 px, 32 px colour pixel icon, name, one quiet
  line; Continuar first and the only ember; Pantalla completa after Ajustes, its label following the state; Salir last, apart and a quiet slab like the rest, the danger carried by its blood-tinted icon and the confirm dialog, Hick ≤ 7); the floor plan; the run summary card.
  Destructive rows (restart, quit) go through `confirmDialog` with a consequence line; a disabled row stays and says why. The floor plan
  paints the explored tiles of the dungeon's own tileset (floor checker with a faint grid, wall tops lit with a dark side, shaded faces) at the
  largest whole pixel scale that fits (`planScale`, crisp; fractional only when a whole scale would leave over 35% of the panel empty;
  cropped to the known area plus a margin so it fills the panel), dithered fog on the frontier, markers as 16×16 pixel icons (player, partner, stairs, berry, enemy, event, gate) and a
  legend of what is shown; it knows only what the minimap knows. The summary card holds the partner in a `sprite-box` (`.pz-sprite`),
  dungeon and floor, tier, time, coins, the four moves with their slot icon and the held items (with an empty state). Under 520 px of
  height or 900 px of width the columns shrink (11.5 / 1fr / 15.5 rem), hints and stat labels hide, and the item list scrolls inside
  its own region. Settings open the shared settings window over it (Esc goes back one step); co-op shows one note: the run keeps going.
  Keys: Up/Down (W/S) move, Left/Right cross to the item chips, Enter/Space act, Esc/Start resume.
- **Location plaque** (`src/ui/location-plaque.ts`, `src/ui/location-plaque-model.ts`, `src/adapters/floor-plaque.ts`, `src/ui/icons/place-icons.ts`,
  `src/styles/location-plaque.css`; owner 2026-11-04): one component names every place on arrival, replacing the canvas town banner, the
  floor card and the dungeon title. A carved relic plate at the top centre (`position: fixed`, top 12 px, 6 px on short landscape,
  `pointer-events: none`, z 3, `role="status"`): stepped gilt end-caps with a lit diamond stud, an original colour 16×16 place icon at
  32 px in a slab tile on the left, the place name (Pixelify 22 px, 18 px on short windows), a hairline divider ornament with a lit diamond,
  a subtitle (Pixelify 16 px: floor, tier when not Easy, boss epithet or "Guardián": only data that exists) and one quiet note (Atkinson
  14 px: floor lore, collapse warning, escape time; hidden on short landscape). Variants, all from tokens: `stone` (gilt frame), `town`
  (ember-warmed slab, gold name), `boss` (blood slab and frame, eclipse-glow name; also the Shrine), `sima` (ink slab, ember ring, eclipse
  glow). One icon per theme: refuge, crypt (also the ruins road), forest, caves, swamp (also the marsh), sima (also the abyss), lookout,
  crater, lake, boss, and one per Senda line (dream, frost, storm, fangs, mask, mirror, flame, bone); the Shrine and the tutorial stairs
  reuse the hub's. The newest place replaces the one on screen; a boss name card wins over the floor card of the same moment. The model
  is pure and a test walks every town map, dungeon, challenge, Senda road, Sima stratum, shrine and boss (icon exists, es and en name,
  variant). Measured contrast of name and subtitle on the plate (worst of its gradient): stone 14.15 / 7.32, town 7.80 / 5.32,
  boss 5.31 / 6.32, sima 14.51 / 7.51.
- **Combat HUD** (`src/ui/hud-layout.ts`, `src/ui/combat-hud-model.ts`, `src/ui/boss-caption.ts`, `src/ui/combat-icons.ts`, `src/data/boss-lore.ts`, drawn by `src/adapters/combat-hud.ts`; owner 2026-11-04). Canvas, in a HUD space of 640x360 "HUD px" (11 px pixel-font grid). Scale rule:
  desktop = how many 640x360 fit the window (2 at 1280x720, 3 at 1920x1080, 4 at 2560x1440; half steps below 2, never under 1); touch = the canvas scale
  with the compact metrics (HUD space under 340 high). Layout (regular / compact):
  - **Boss bar**, bottom centre, 57% of the width (touch: half, 300 max, clear of the thumb buttons). Name in large spaced caps, epithet (lore line) under it,
    type badge and status icons (stun, poison, burn, mark, weakened, guard, held) at the right of the name row; the bar has a gilt frame, diamond ends, a
    delayed chip trail in `cursor` gold (hold 250 ms, drain 350 ms), phase notches (card segments; Aegislash's 50% unsheathing), one diamond pip per spell
    card under a seal icon (passed dim, live gold) and the card clock with an hourglass (red in the last 5 s). Entrance: name 420 ms, bar fills over 900 ms.
    Defeat: dark band across the lower third with "GUARDIÁN CAÍDO" / "GUARDIAN FELLED" in gold for 3.4 s.
  - **Status window**, top left, 214x84: portrait in a sprite-fit box with a level badge, HP bar with numbers and chip trail, stamina bolt bar, a thin XP line, the
    passive mask icon with its state in words, stairs + floor, coin + coins, held-items chip. Co-op partners: 22 px frames under it (portrait, name, HP; downed =
    dim + skull + "Caído"). Touch: starts right of the Pause button.
  - **Move slots**, bottom right, 52x52 squares (never under 44 CSS px at scale 1): slot-role icon (fast, heavy, boost, area), a band and wash in the move's type colour,
    the key or pad button of the last device used (`src/adapters/bindings.ts`, gamepad help data), name squeezed to fit, radial cooldown sweep with seconds,
    red wash and name when stamina is short, tier-coloured rank diamonds. 1-2 slots in a row, 3-4 as a 2x2 block. Touch draws none.
  - **Boss announcement**, upper third (below the location plaque): the move name large in ember between gilt brackets, its sign under it with a seal icon,
    one telegraph cue (volley, ring, area, dash, summon, guard: icon and a line). Enter 180 ms, hold 1.5 s, exit 300 ms; reduced motion = plain fade.
  - Collisions are settled in the layout model: the message log lifts over the boss block, the hint bar rises over it during a boss fight (`liftHintBand`), the
    now-playing line sits under the minimap, the level-up flash sits under the announcement. Damage numbers are ink-outlined and bigger on heavy hits, "!" on
    super-effective, burn and poison in their own colour. `tests/ui/hud-layout.test.ts` proves no two panels overlap at every viewport.
Play view (town and every dungeon, owner 2026-11-04): full-bleed. The canvas covers the viewport, no margins and no page chrome;
the logical view follows the window aspect (`src/adapters/viewport.ts`: integer pixel scale on desktop, 320 world px on the short
side on touch), so a wide window shows more map, never a stretched one. Beyond a small map the dungeon's darkest wall colour
fills. The view is top-down: no sky, horizon or sun is drawn (the eclipse survives only as a tint). HUD panels and the touch
layer anchor to the real viewport edges. The legal notice is not drawn over play.

Accessibility: every hub control is a real `<button>` with an accessible name; arrows move focus spatially, Enter confirms.

## 5. Motion System

- Window open 120 ms ease-out (existing). Focus halo 120 ms. Backdrop: slow corona pulse (1.4 s), embers, fog drift —
  reason: the scene is alive while the player decides. Partner idle animation from its sprite.
- `prefers-reduced-motion`: no fog drift, no pulse on Play, embers static.
- Location plaque entrance: the plate unfurls from its centre (`scaleX` 0 to 1 with a centre clip) in 260 ms ease-out, then the icon and the text
  fade-rise 6 px over 160 ms, staggered 80 ms; it holds 2.2 s and leaves fading up 10 px in 300 ms ease-in. Reason: it marks the change of place
  without blocking play (Peak-End); it takes no input and never covers the HUD. Under `prefers-reduced-motion`: a plain 200 ms fade in and 300 ms
  fade out, no unfurl, no rise (`plaqueTiming`, `src/ui/location-plaque-model.ts`).
- Combat HUD (§4): the boss announcement enters in 180 ms (it settles from 112% like a seal pressed down, its rule draws out from the middle), holds 1.5 s and exits in
  300 ms: reason, it must stand out at the moment the player has to read an attack. The boss entrance (name 420 ms, bar 900 ms), the chip trail (<= 600 ms: Doherty) and
  the felled banner (300 ms in, 700 ms out) each say what just happened. `prefers-reduced-motion`: the announcement only fades (no settle, no drawn rule).

## 6. Accessibility Baselines

WCAG 2.2 AA: text ≥ 4.5:1 on the slab, large/pixel labels ≥ 3:1, focus always visible (gold frame + halo), keyboard
and gamepad reach every control, touch targets ≥ 44 px.

## 7. Anti-patterns

- Native `<select>`, `<dialog>`, date inputs, `alert()`: never (shared rule).
- Fake urgency badges or timers on the hub: badges only for real unseen content.
- More than one glowing call to action per screen.
- Rounded "bubbly" corners on stone surfaces.

## 8. Decision Log

- 2026-11-03: Title becomes a game hub with icon rails, partner altar and a dominant JUGAR (owner). Supersedes
  2026-10-26 "muy pocos botones" (3 title entries). Services still work from the town as before.
- 2026-11-03: Windows move from Mystery Dungeon blue to the souls "relic" slab (dark stone, old-gold frame,
  ember cursor). Supersedes the blue window palette of `PALETTE` (2026-10).
- 2026-11-03: Hub icons are original coloured pixel art (16×16), not single-stroke line glyphs.
- 2026-11-04: Account entry becomes a right-hand side drawer (Google, Discord, email, guest with honest pros and cons)
  instead of a centred window; Friends follows the picker pattern (owner). Provider marks are our own pixel drawings.
- 2026-11-04 (owner: "Los pokemon se cortan, que no pase en ningún otro sitio"): sprite fit rule. Every Pokémon is drawn whole
  inside a fixed `sprite-box` (shrine sheet and cards, species picker, Maestro chips, evolution, challenges, loadout head,
  gacha collection); cropping with negative margins and `overflow: hidden` is banned (§4).
- 2026-11-04 (owner: "la descripción tapa cosas"): the achievements window owns one row per part (head, body that scrolls
  inside, detail, foot); a tile holds its own date, it never spills into the row above or below.
- 2026-11-04 (owner: "Sigue pareciéndome demasiado saturado"): the Maestro becomes an accordion list (§4): one column,
  four slot groups, calm rows, scroll inside. Supersedes the 3-column move card grid and the slot tabs of 2026-11-03.
- 2026-11-04 (owner: "lo de ganar y perder rediséñalo también"): every win/lose end screen (dungeon, challenge, Sima, shrine, co-op) shares one relic dialog (`src/app/end-screen.ts`): sprite box + outcome, cards that group the figures, pixel coin on rewards, at most two actions with one ember. In-game menus and end screens are dialogs over the run's frozen last frame (`ui/scene.ts`); the eclipse/town backdrop belongs to the title and hub only.
- 2026-11-04 (owner: "Rediseña también el menú de pausa ... un mapa mucho más realista y visible"): the pause menu becomes a relic window with actions, a real floor plan (tileset colours, fog, pixel-icon markers, legend) and a run summary card that absorbs the held items (§4). Supersedes the plain cursor list plus a separate "Objetos equipados" window. Quick settings now open the full settings window.
- 2026-11-04 (owner: "Quita los márgenes, añade ayudas visuales de controles, ... pantalla completa y quita lo del eclipse puesto en la parte de arriba"): the play view is full-bleed (§3), the town sky band and birds and the Sima's eclipse disc and spires are removed (top-down, no horizon), and an in-game hint bar with device glyphs is added (§4).
- 2026-11-04 (owner: "rediseña también con animación de entrada, decoración, icono representativo en el mapa ... todos los carteles de ubicación superiores"): the town name banner, the floor card and the dungeon title become one location plaque (§4, §5) with a place icon, a subtitle and town, boss and Sima variants. Supersedes the plain dark box with gold text and the centred floor card.
- 2026-11-04 (owner: "Haz los pokemon también más grandes", "cuando haya que interactuar, que salga como tooltip cerca de lo que vas a hacer", "rediseña también los diálogos", "más grande las ayudas visuales"): creatures are drawn at 1.5x (Creature scale, §4); interaction becomes a world tooltip over its target and leaves the hint bar (§4); the canvas dialogue box becomes a DOM relic slab with portrait, name plate, typewriter, page counter and continue glyph (§4); the hint bar grows (chip >= 40 px, keycap >= 28 px, label >= 16 px). Supersedes the interact chip of the 2026-11-04 hint bar and the Mystery Dungeon canvas dialogue box.
- 2026-11-04 (owner: "rediseña y haz mucho más grande ... todo esto dentro de combate ... la barra de jefe ... que tenga estética de jefe de Dark Souls"): the combat HUD is redone at the relic scale (§4 Combat HUD): HUD scale
  from the viewport (2 at 1280x720, 3 at 1920x1080), a bottom-centre Souls boss bar with epithet, chip trail, phase notches, card pips, status icons, entrance and "felled" banner, a
  bigger partner status window with co-op frames, square relic move slots with device glyphs and radial cooldowns, and a boss-event announcement with a telegraph cue. Supersedes the 196x58 status box, the
  104x30 move chips, the 260 px boss bar and the thin spell strip.
- 2026-11-04 (owner: "el aviso este y de nueva actualización y demás que salga con el fondo blur oscurecido, arriba y más grande para darle más prioridad visual"): update, install and news notices become one System notice (§4) over a darkened, blurred veil, top centre and large. Scoped decision: the blur applies to these notices only; the "blurred-free vignette" rule of overlays and windows stands for everything else. Supersedes the small bottom-left install card, the bottom update toast and the news screen opening by itself on boot.
- 2026-11-04 (owner: "quita al mimikyu y al gastly de ahí y presenta mejor a tu pokemon", "según el pokémon que tengas tengas un avatar custom con la cara del pokémon, no el sprite repetido"): the hub backdrop loses its residents; the partner stands on a carved altar with a corona, ember light and a nameplate that carries name, types, bond, passive and a 44 px "Cambiar" button (§4 Partner altar); the profile plate and the account drawer show the partner's face portrait (§4 Face avatar). Supersedes the flat red rune ellipse and the small nameplate of 2026-11-03, and the two residents of the same date.
