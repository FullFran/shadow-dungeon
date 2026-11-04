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
- **Overlay** (`.town-shop`): service windows open over a darkened, blurred-free vignette of the scene.
- **Pixel icons** (`src/ui/pixel-icons.ts`): 16×16 maps, 3–6 colours each, rendered as crisp SVG rects. Every
  service has one; line glyphs (`glyphSvg`) remain only on the inked town plan.

- **Side drawer** (`.drawer-veil` + `.ad-drawer`, `src/app/account-drawer.ts`): the quick-entry pattern for short forms and
  account state (owner, 2026-11-04). A full-height relic slab (400 px, 100% under 520 px) slides in from the right over a
  darkened scene; click outside and Esc close it (`ui/dismiss.ts`), focus is trapped, arrows/Tab move through the controls,
  Enter acts. Order top to bottom: why in one line, providers, divider, form, the one ember call to action, the guest
  choice as an equal block (at most three facts per side, no pressure). In a short landscape window (max-height 520 px)
  the two halves sit side by side. Slide 160 ms ease-out (the panel comes from the edge it lives on); none under
  `prefers-reduced-motion`. Pending shows at once, errors stay inline. Shared controls: `src/styles/relic-controls.css`.
- **Welcome gate** (`src/app/welcome-screen.ts`, `src/app/onboarding.ts`, `src/styles/onboarding.css`; owner 2026-11-04): the first screen of a profile with no walker,
  full screen over the eclipse backdrop and never the hub (no empty altar anywhere). Logo, one sober line of lore and two equal relic cards
  (Hick: two primary choices): "Iniciar sesión / Crear cuenta" (opens the Side drawer; routes on when it closes signed in) and "Jugar como
  invitado". Each card: 56 px pixel icon, title, the drawer's own three facts (account pros, guest cons: its strings, never new claims), a quiet
  action line. No static ember (the focus halo is the only glow; neither choice is pushed). A quiet link "Ya tengo partida en este
  dispositivo" only when the device holds a save. Arrows/Enter/1-2, pad and touch; at most 72 ch of lore, `max-height: 520px` compacts it.
- **Questionnaire** (`src/app/quiz-screen.ts`, `src/app/quiz-view.ts`, `src/ui/icons/onboarding-icons.ts`): one question per screen on a carved slab
  (`.ob-slab`: window gradient, gold frame, inner bevel, hard drop). Progress is a rail of oath runes (16x16 pixel icons, lit = answered,
  ember halo = the one being asked, dim = to come) plus "n / total", one rune per real question (Goal-Gradient, honest). Answers are relic
  cards >= 68 px (100 px in short landscape, three across): number keycap, 44 px original pixel icon (24 icons, objects never faces), text in
  Atkinson. Keys 1-3, arrows/WASD, Enter; Esc/Backspace is one step back and marks the answer you had given (Error prevention); the voice
  ("...¿Me oyes?") opens it. Slide 180 ms ease-out (`translateX` 28 px + fade, direction follows forward/back); instant under
  `prefers-reduced-motion`. Scoring is `core/quiz.ts`, untouched.
- **Walker reveal** (same files; the onboarding's Peak): the silhouette (`filter: brightness(0)`) lights up after 450 ms over 900 ms on an altar of
  two stone slabs with an ember rune, a warm glow behind and 14 ember points rising (4 s, offset, drift fixed so a redraw never jumps; still
  points under reduced motion). The sprite lives in `.ob-altar-sprite` (a `sprite-box`, 220x200, 300x280 from 900 px of height, 132x116 in
  short landscape) so it is never cropped. Name (Pixelify), type badges, "Eres de naturaleza X..." and the nature's description as the lore
  line. One ember call to action "Comenzar" (>= 60 px), and quiet links: "Repetir cuestionario", "Elegir otro Pokémon" (four starter cards,
  `.ob-pick-art` sprite boxes), "Volver". Progress (step, seed, answers, hand-picked walker) is kept in the device key
  `mazmorra-sombria.onboarding`, so a reload continues where the player was.
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
- 2026-11-04 (owner: "no debería salir el círculo rojo ni el hueco para tu pokémon, debe primero pedirte elegir si como invitado o iniciar sesión y guiarte primero al onboarding/cuestionario para elegir tu caminante, que también debe rediseñarse al completo"): a profile with no walker never meets the hub or its empty altar; it enters through a Welcome gate (account or guest, §4), then the prologue, a redesigned Questionnaire (one question per slab, oath-rune progress rail, relic answer cards with original pixel icons, 180 ms slide) and a Walker reveal (silhouette lit on an altar with embers, one ember call to action), then the first run (§4, §5). Scoring, question and answer texts and the story order are unchanged. Supersedes the black-screen quiz of MD-style cursor lists and its Accept/Choose window.
