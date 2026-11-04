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
- **Sprite fit rule** (`src/ui/sprite-fit.ts`, `src/styles/sprite-fit.css`): a Pokémon is never cropped. Its box has a
  fixed size and the class `sprite-box`; the canvas fills the box (`object-fit: contain`, bottom-centred) and, inside a
  `sprite-box`, is cropped to the pixels the idle animation really covers (`portrait()` in `src/app/loadout.ts`), so the
  box fits the creature itself and reserves its headroom. Forbidden: `overflow: hidden` on a sprite box, negative
  `margin-bottom` or a fixed `height: Npx !important` on a sprite canvas, scaling a whole stage with `transform`.
  Every box is declared in `SPRITE_BOXES`; `tests/ui/sprite-fit.test.ts` fits every playable species (base, shiny,
  female sheets) and every shrine boss in every box and checks the stylesheet agrees.

- **Pause window** (`src/app/pause-view.ts`, `src/app/pause-model.ts`, `src/app/pause-map.ts`, `src/styles/pause.css`): one centred relic
  window over the dimmed, frozen run (the overlay is a `no-dismiss` veil: a press outside does nothing, so a stray click never resumes a
  run or reaches an action). Three fixed columns, no page scroll: actions (slab rows ≥ 44 px, 32 px colour pixel icon, name, one quiet
  line; Continuar first and the only ember, Salir last and in the danger colour, Hick ≤ 7); the floor plan; the run summary card.
  Destructive rows (restart, quit) go through `confirmDialog` with a consequence line; a disabled row stays and says why. The floor plan
  paints the explored tiles of the dungeon's own tileset at the largest whole pixel scale that fits (`mapScale`, crisp, cropped to the
  known area plus a margin), fog on the frontier, markers as 16×16 pixel icons (player, partner, stairs, berry, enemy, event, gate) and a
  legend of what is shown; it knows only what the minimap knows. The summary card holds the partner in a `sprite-box` (`.pz-sprite`),
  dungeon and floor, tier, time, coins, the four moves with their slot icon and the held items (with an empty state). Under 520 px of
  height or 900 px of width the columns shrink (11.5 / 1fr / 15.5 rem), hints and stat labels hide, and the item list scrolls inside
  its own region. Settings open the shared settings window over it (Esc goes back one step); co-op shows one note: the run keeps going.
  Keys: Up/Down (W/S) move, Left/Right cross to the item chips, Enter/Space act, Esc/Start resume.

Accessibility: every hub control is a real `<button>` with an accessible name; arrows move focus spatially, Enter confirms.

## 5. Motion System

- Window open 120 ms ease-out (existing). Focus halo 120 ms. Backdrop: slow corona pulse (1.4 s), embers, fog drift —
  reason: the scene is alive while the player decides. Partner idle animation from its sprite.
- `prefers-reduced-motion`: no fog drift, no pulse on Play, embers static.

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
- 2026-11-04 (owner: "Rediseña también el menú de pausa ... un mapa mucho más realista y visible"): the pause menu becomes a relic window with actions, a real floor plan (tileset colours, fog, pixel-icon markers, legend) and a run summary card that absorbs the held items (§4). Supersedes the plain cursor list plus a separate "Objetos equipados" window. Quick settings now open the full settings window.
