import { acceptPact, declinePact, eatBought, merchantItem, nearSimaEvent, pactEffects, rewardOffer, rewardsItems, spendCoins, type SimaEventState, type SimaRecord } from '../core/sima-events';
import { addTime } from '../core/endless';
import { addItem } from '../core/items';
import type { PactEffect, SimaEvents } from '../data/sima';
import { announcedOnEntry, simaNews } from '../adapters/sima-events-view';
import { openSimaChoice, type SimaChoiceOption } from './sima-choice';
import type { ItemId } from '../data/items';
import type { MoveId } from '../data/moves';
import type { SpeciesId } from '../data/species';
import type { UpgradeLevels } from '../data/upgrades';
import { roomCleared } from '../core/rooms';
import { collapseProximity } from '../core/collapse';
import { chooseItem, dungeonOf, floorPlanOf, followToFloor, isBossFloor, progressRun, roomExit, setClock, startRun, tickRunClock, type RunState } from '../core/run';
import { runUpgrades, scaleCoins } from '../core/endless';
import { restartsLeft, worldDifficulty } from '../core/difficulty';
import { DEFAULT_DIFFICULTY, type Difficulty } from '../data/difficulty';
import { bandLoreKey, bandStartsAt, simaBandAt, simaPalette } from '../core/sima';
import { tickDue, type RunClock } from '../adapters/clock-hud';
import { loadTestFloor } from '../core/test-floor';
import { GUARDIAN_CINEMATICS, type CinematicPhase } from '../data/guardian-cinematics';
import { CARD_MS } from './guardian-cinematic';
import { dungeonById, musicFor, type DungeonId } from '../data/dungeons';
import type { MusicContext } from '../data/music';
import { trackNote, type DungeonIntro, type NowPlaying, type SpellBanner } from '../adapters/intro-card';
import { bossBar } from '../core/boss';
import { fogRadiusTiles } from '../core/fog';
import { spellCardKey } from '../data/enemies';
import { WISP_BERRY } from '../core/wisp';
import { clickLockActive, configureLock, enemyUnderCursor } from '../core/lockon';
import type { GameEvent, LockType, PlayerInput, WorldState } from '../core/state';
import { step } from '../core/step';
import { coinBreakdown, emptyTally, tallyFloor, tallyStep, type CoinBreakdown, type CoinTally } from '../core/coins';
import { advanceClock, FIXED_DT_MS, frameTime } from '../core/timestep';
import { tileOf } from '../core/tiles';
import { length, vec } from '../core/vec';
import type { SheetStore } from '../adapters/assets';
import { floorEntrySounds, type AudioEngine } from '../adapters/audio';
import { heldItems, type HeldItem } from '../adapters/hud';
import type { FloorCard } from '../adapters/card';
import { createMemory, revealAround, type MinimapMemory } from '../adapters/minimap';
import { emptyLog, eventMessages, itemPickedText, pruneLog, pushMessage, type LogTone, type MessageLog } from '../adapters/message-log';
import { attachInput, toPlayerInput } from '../adapters/input';
import { applyEvents, initialJuice, rumbleLevel, tickJuice } from '../adapters/juice';
import { createRenderer } from '../adapters/renderer';
import { cameraView, followCamera, lerpVec } from '../adapters/view';
import { fitCanvasToWindow } from '../adapters/fit';
import { isTouchUi } from '../adapters/touch-mode';
import { holdWakeLock } from '../adapters/wake-lock';
import { mergeInputs, touchToPlayerInput } from '../adapters/touch';
import { hapticPulse, vibrate } from '../adapters/haptics';
import { createTouchControls } from '../ui/touch-controls';
import type { NetSession } from '../net/session';
import { t } from '../i18n';
import { displayName } from '../net/nickname';
import type { RosterEntry } from '../net/protocol';
import { openItemPick, pickCards, pickIndexForKey, pickPausesSimulation } from './item-pick';
import { simulationPaused, type MenuActions } from './menu';
import { createNetOverlay } from './net-overlay';
import { hudScaleFor } from '../ui/hud-layout';

/** Endless, shared run: the host sends its clock about this often (and on every floor change). */
const CLOCK_SEND_MS = 1000;

/** World pixels shown on screen; the canvas is this times an integer scale. */
export const VIEW_WIDTH = 512;
export const VIEW_HEIGHT = 320;

/** `eclipse`: the endless dungeon's clock ran out (a score end). */
export type GameResult = 'defeat' | 'victory' | 'eclipse';

/** Shown on the end screens. */
export interface RunSummary {
  /** The dungeon of the run (records are kept per dungeon). */
  dungeon: DungeonId;
  floor: number;
  seed: number;
  level: number;
  items: readonly ItemId[];
  /** Pokémonedas this peer earned (each peer of a shared run earns for itself). */
  coins: CoinBreakdown;
  /** Endless dungeon: the clock left when the run ended (the score's tie-break). */
  clockMs?: number;
  /** The run's tier (the host's in a shared run). */
  difficulty: Difficulty;
  /** Sima: the floor events taken this run (end screen). */
  simaEvents?: readonly SimaRecord[];
}

export interface GameOptions {
  /** The local player's species (default Mimikyu); `loadout` must be its own moves. */
  species?: SpeciesId;
  loadout: readonly (MoveId | null)[];
  /** Permanent upgrade levels of the local player (the shop's), applied at run start. */
  upgrades?: UpgradeLevels;
  lockType: LockType;
  clickToLock: boolean;
  seed?: number;
  /** The dungeon to run (the Crypt by default); a shared run uses the host's. */
  dungeon?: DungeonId;
  /** The run's tier (easy by default); a shared run uses the host's. */
  difficulty?: Difficulty;
  /** Development only: start on this floor of the run (`?floor=` on the dev server). */
  startFloor?: number;
  /** Development only: the endless clock starts at this many ms (`?clock=` on the dev server). */
  startClockMs?: number;
  /** Development only, solo: replace the first floor with the test arena and these enemies (`?spawn=` on the dev server). */
  testSpawns?: readonly SpeciesId[];
  /** Sound effects from core events and the floor music: Crypt, collapse or guardian (ducked while the Esc menu is open). */
  audio?: Pick<AudioEngine, 'handleEvents' | 'play' | 'setMusic' | 'setDucked' | 'setRumble'>;
  /** The M key. */
  onToggleMute?(): void;
  /** Esc: shows the menu overlay (with the held items listed) and returns a function that removes it. */
  openMenu?(actions: MenuActions, held: readonly HeldItem[]): () => void;
  /** "Quit to main menu" in the Esc menu. */
  onQuit?(): void;
  onEnd(result: GameResult, summary: RunSummary): void;
  /**
   * Solo only: plays a guardian cinematic over the game (before the guardian
   * fight and after it falls) and returns a function that removes it, or null
   * when there is nothing to play; `onDone` runs when it ends or is skipped.
   * The run stands still meanwhile. Shared runs get the name card on the
   * canvas instead and never pause.
   */
  playCinematic?(request: { species: SpeciesId; phase: CinematicPhase }, onDone: () => void): (() => void) | null;
  /** Shared run (`?net=local`): this peer's session, role and player id. Absent solo. */
  net?: { session: NetSession; role: 'host' | 'guest'; localId: string; keepSession?: boolean };
  /** Touch settings, read live (src/adapters/touch.ts); the on-screen controls exist only while `html.touch` is set. */
  touch?: { autoAim(): boolean; haptics(): boolean };
}

/** What a fainted player sends in a shared run: nothing (an ally standing by gets it up: core/revive.ts). */
function idleInput(from: PlayerInput): PlayerInput {
  return { ...from, move: vec(0, 0), roll: false, slots: from.slots.map(() => false), slotMouse: from.slotMouse.map(() => false), click: false, lock: false, wheel: 0 };
}

export interface RunningGame {
  /** Applies changed lock settings mid-run (from the Esc menu). */
  setLock(settings: { lockType: LockType; clickToLock: boolean }): void;
  stop(): void;
}

/**
 * The play session: fixed-step simulation, interpolated rendering, juice and
 * the run (generated floors 1-3 -> stairs -> boss floor; death or the boss falling ends it),
 * with sound driven by the same events and the music following the room.
 * Esc opens the menu: game input is cut off and, per the pause policy in
 * `menu.ts`, the simulation stands still until it closes. Entering a floor
 * after the first offers three held items (item-pick.ts): solo, input is cut
 * off and the game pauses until one is picked; a shared run keeps running
 * and only clicks on the cards or 1/2/3 pick.
 */
/** Player id -> nickname (or the "Jugador-XYZ" fallback) for the tags over remote players. */
export function rosterNames(roster: readonly RosterEntry[]): Map<string, string> {
  return new Map(roster.map((r) => [r.id, displayName(r.name, t('nickname.default'), r.peer)]));
}

export function startGame(canvas: HTMLCanvasElement, sheets: SheetStore, options: GameOptions): RunningGame {
  const keyboard = attachInput(canvas);
  /** On-screen controls (hidden by CSS unless html.touch); Pause stands in for Esc. */
  const touch = createTouchControls({
    tapTarget: canvas,
    buttons: [
      { id: 'pause', label: t('touch.pause'), className: 'top', onPress: () => showMenu() },
      { id: 'map', label: t('touch.map'), className: 'top', onPress: () => (showMinimap = !showMinimap) },
      { id: 'lock', label: t('touch.lock'), swipe: true },
      { id: 'roll', label: t('touch.roll') },
      { id: 'heavy', label: t('touch.heavy'), className: 'big' },
      { id: 'fast', label: t('touch.fast'), className: 'big' },
    ],
  });
  (canvas.parentElement ?? document.body).append(touch.element);
  /** Keyboard + mouse and touch, suspended and disposed together. */
  const input = {
    take: () => keyboard.take(),
    setSuspended(suspended: boolean) {
      keyboard.setSuspended(suspended);
      touch.setSuspended(suspended);
    },
    dispose() {
      keyboard.dispose();
      touch.dispose();
    },
  };
  // Touch devices: keep the screen awake while the run lasts.
  const releaseWakeLock = isTouchUi() ? holdWakeLock() : () => {};
  const renderer = createRenderer(canvas, sheets);
  const net = options.net;
  /** F3 in a shared run: the net stats overlay. */
  const overlay = net ? createNetOverlay(canvas.parentElement ?? document.body, net.session, net.role, net.localId) : null;
  const started = startRun(
    options.seed ?? 1,
    {
      ...(options.species ? { species: options.species } : {}),
      loadout: options.loadout,
      lockType: options.lockType,
      clickToLock: options.clickToLock,
      // Modo puro: no shop upgrades in the endless dungeon (core/endless.ts).
      ...(runUpgrades(dungeonById(options.dungeon), options.upgrades) ? { upgrades: options.upgrades } : {}),
      // Co-op scaling (core/party.ts): the room's roster at the start counts for floor 1; later floors count the players present.
      ...(net ? { localId: net.localId, role: net.role, party: net.session.roster().length } : {}),
      ...(options.difficulty && options.difficulty !== DEFAULT_DIFFICULTY ? { difficulty: options.difficulty } : {}),
    },
    options.startFloor,
    options.dungeon,
  );
  let run: RunState = options.startClockMs !== undefined && started.run.clockMs !== undefined ? setClock(started.run, options.startClockMs) : started.run;
  let world: WorldState = !net && options.testSpawns?.length ? loadTestFloor(started.world, options.testSpawns) : started.world;
  // Development server only: `?bossHp=0.4` starts the floor's enemies at that share of their HP (to look at Aegislash's phase 2).
  const devBossHp = import.meta.env.DEV ? Number.parseFloat(new URLSearchParams(window.location.search).get('bossHp') ?? '') : Number.NaN;
  if (devBossHp > 0 && devBossHp <= 1) world = { ...world, enemies: world.enemies.map((e) => ({ ...e, hp: Math.max(1, Math.round(e.maxHp * devBossHp)) })) };
  // Development server only: `?nearEvent=1` starts a Sima floor beside its event (screenshots of the shrine, the nest...).
  const devNearEvent = import.meta.env.DEV && new URLSearchParams(window.location.search).get('nearEvent') === '1';
  if (devNearEvent && world.simaEvent) world = { ...world, player: { ...world.player, pos: { x: world.simaEvent.pos.x, y: world.simaEvent.pos.y + 34 } } };
  let lockSettings = { lockType: options.lockType, clickToLock: options.clickToLock };
  /** World as the current floor was entered, for "Restart floor". */
  let floorStart = world;
  /** Pokémonedas tally of the run, and as the current floor was entered ("Restart floor" must not pay twice). */
  let tally: CoinTally = emptyTally();
  let floorStartTally = tally;
  /** The run's tier, and the solo "Restart floor" uses spent on this floor (limited on hard and nightmare). */
  const difficulty = worldDifficulty(world);
  let restartsUsed = 0;
  let prev = world;
  let accumulator = 0;
  let juice = initialJuice();
  let realMs = 0;
  let lastFrame = performance.now();
  let lastHurtAt = Number.NEGATIVE_INFINITY;
  const defeatedAt = new Map<string, number>();
  let moving = false;
  let lastInput: PlayerInput | null = null;
  let pixelScale = 1;
  let hudScale = 1;
  let ended = false;
  let raf = 0;
  /** The guardian cinematic on screen (solo), while it plays. */
  let closeCinematic: (() => void) | null = null;
  /** Smoothed camera focus; the visible rect it gives is also the lock-on view. */
  let camera = world.player.pos;
  let view = cameraView(camera, VIEW_WIDTH, VIEW_HEIGHT, world.arena);
  let closeMenu: (() => void) | null = null;
  /** The held item pick overlay, while open. */
  let closePick: (() => void) | null = null;
  const overlayParent = canvas.parentElement ?? document.body;
  const audio = options.audio;
  /** Floor 1 entry title and the "♪ title" note of the last music change (presentation only). */
  let intro: DungeonIntro | null = null;
  let nowPlaying: NowPlaying | null = null;
  let playing: MusicContext | null = null;
  /** The boss spell card on screen, and the last card seen (host and guest alike read it from the boss state). */
  let spell: SpellBanner | null = null;
  let lastCard: string | null = null;
  // Each peer of a shared run plays the music of its own floor (nothing goes over the network).
  const music = () => {
    const context = musicFor(dungeonOf(run), floorPlanOf(run), run.kind, run.floor);
    audio?.setMusic(context);
    if (context !== playing) nowPlaying = { title: trackNote(context), shownAtMs: realMs };
    playing = context;
  };
  /** Endless, shared run: simulated time since the host last sent its clock. */
  let clockSentMs = 0;
  /** Endless: the last time added to the run clock, shown under it for a moment. */
  let clockBonus: RunClock['bonus'] = null;
  const lowMs = dungeonOf(run).endless?.clock.lowMs ?? 0;
  /** Endless: a tick every second once the clock is low, and "+N s" when time is added. */
  const watchClock = (beforeMs: number | undefined, bonusMs = 0, reason?: string) => {
    if (bonusMs > 0) clockBonus = { ms: bonusMs, shownAtMs: realMs, ...(reason ? { reason } : {}) };
    if (beforeMs !== undefined && run.clockMs !== undefined && tickDue(beforeMs, run.clockMs, lowMs)) audio?.play('click');
  };
  /** Title card of the current floor; game input keeps working while it shows. */
  let card: FloorCard | null = null;
  /** Sima floor events (sima-events.ts): the shrine's or merchant's choice on screen and its pick handler. */
  let closeChoice: (() => void) | null = null;
  let choicePick: ((index: number) => void) | null = null;
  /** The player walked away from (or used) the shrine or merchant: it opens again only after leaving its reach. */
  let choiceDismissed = false;
  /** Pokémonedas spent at the merchant (taken off the run's pay), and as the floor was entered ("Restart floor"). */
  let simaSpent = 0;
  let floorStartSpent = 0;
  /** This floor's merchant purchases, and whether the shrine's time and the event's item pick were already given (no double pay on "Restart floor"). */
  let merchantBerries = 0;
  let merchantSold = false;
  let shrineTimePaid = false;
  let eventRewarded = false;
  /** The event as last seen (each peer reads its changes from its own world), and the events taken this run. */
  let lastEvent: SimaEventState | undefined;
  const simaLog: SimaRecord[] = [];
  /** Fog-of-war memory of the current floor's minimap (presentation state; reset on each floor and on restart). */
  let minimap: MinimapMemory | null = null;
  let showMinimap = true;
  /** Message log at the bottom left, on the real (pause-aware) clock. */
  let log: MessageLog = emptyLog();
  const say = (text: string, tone: LogTone) => (log = pushMessage(log, text, tone, realMs));
  /** The spirit light's cache was reached on this floor (its line shows once). */
  let wispFound = false;
  /** The Sima's depth band of the current floor (data/sima.ts); null in other dungeons. */
  const simaBand = () => {
    const bands = dungeonOf(run).endless?.bands;
    return bands ? simaBandAt(bands, run.floor) : null;
  };
  function announceFloor(descended: boolean): void {
    const lore = dungeonOf(run).lore;
    const bands = dungeonOf(run).endless?.bands;
    // The floor's own lore line, when the dungeon has one (the Crypt; the Sima's by depth band).
    const floorKey = bands ? bandLoreKey(bands, run.floor) : lore.floorKeys?.[run.floor - 1];
    const floorLore = floorKey ? { lore: t(floorKey) } : {};
    card = { dungeon: t(lore.nameKey), floor: run.floor, kind: run.kind, escape: run.escape, shownAtMs: realMs, ...floorLore };
    // Floor 1 opens with the dungeon's own title instead of the floor card (Touhou-style stage title).
    if (run.floor === 1) {
      intro = { name: t(lore.nameKey), subtitle: t(lore.subtitleKey), shownAtMs: realMs, ...floorLore };
      card = null;
    }
    // The Sima's first floor of a new depth band: the band's own title card, and the track note again (Touhou style).
    const band = simaBand();
    if (bands && band && bandStartsAt(bands, run.floor)) {
      intro = { name: t(band.nameKey), subtitle: t(band.subtitleKey), shownAtMs: realMs, ...floorLore };
      card = null;
      if (playing) nowPlaying = { title: trackNote(playing), shownAtMs: realMs };
    }
    if (run.kind !== 'normal') say(t(`card.${run.kind}`), 'warn');
    // The Forest's spirit light (core/wisp.ts).
    wispFound = false;
    if (world.wisp) say(t('forest.wisp.appear'), 'info');
    // A Sima floor event makes itself known (not the monster house or the ambush: those are surprises).
    if (world.simaEvent && announcedOnEntry(world.simaEvent.kind)) say(t(`sima.log.${world.simaEvent.kind}.here`), 'warn');
    // A guardian echo of the endless dungeon: only a short name card, no cinematic.
    const plan = floorPlanOf(run);
    const echo = plan.kind === 'room' && plan.role === 'echo' ? world.enemies[0] : undefined;
    if (echo) {
      // The echo's name card replaces the floor card (they would overlap).
      // The Sima's own boss has its own line under its name.
      const subtitle = echo.species === 'eclipse-echo' ? 'sima.echo.subtitle' : 'endless.echo';
      intro = { name: t(`species.${echo.species}`), subtitle: t(subtitle).replace('{floor}', String(run.floor)), shownAtMs: realMs };
      card = null;
    }
    for (const id of floorEntrySounds(run.kind, descended)) audio?.play(id);
    minimap = world.arena.tiles ? createMemory(world.arena.tiles) : null;
  }

  function hideMenu(): void {
    if (!closeMenu) return;
    closeMenu();
    closeMenu = null;
    // A solo pick still open keeps game input cut off.
    input.setSuspended(closePick !== null && !net);
    audio?.setDucked(false);
  }

  function hideChoice(): void {
    if (!closeChoice) return;
    closeChoice();
    closeChoice = null;
    choicePick = null;
    choiceDismissed = true;
    if (!net && !closeMenu && !closePick) input.setSuspended(false);
  }

  function showChoice(title: string, hint: string, options: readonly SimaChoiceOption[], onPick: (index: number) => void): void {
    hideChoice();
    choiceDismissed = false;
    if (!net) input.setSuspended(true);
    choicePick = (index) => {
      if (options[index] && !options[index]!.disabled) onPick(index);
    };
    closeChoice = openSimaChoice(overlayParent, title, hint, options, Boolean(net), (i) => choicePick?.(i), hideChoice);
  }

  /** Run Pokémonedas still in hand (the merchant takes them off the pay). */
  const coinsInHand = (): number => scaleCoins(coinBreakdown(tally, null, difficulty), dungeonOf(run).endless?.coinScale ?? 1).total - simaSpent;

  /** "+30 % daño", "enemigos +20 % rápidos"...: a pact's effects as text. */
  function effectText(effect: PactEffect): string {
    const pct = (v: number) => String(Math.round((v - 1) * 100));
    const parts: string[] = [];
    if (effect.playerDamage && effect.playerDamage !== 1) parts.push(t('sima.effect.playerDamage').replace('{n}', pct(effect.playerDamage)));
    if (effect.healShare) parts.push(t('sima.effect.heal'));
    if (effect.timeMs) parts.push(t('sima.effect.time').replace('{s}', String(Math.round(effect.timeMs / 1000))));
    if (effect.enemySpeed && effect.enemySpeed !== 1) parts.push(t('sima.effect.enemySpeed').replace('{n}', pct(effect.enemySpeed)));
    if (effect.enemyDamage && effect.enemyDamage !== 1) parts.push(t('sima.effect.enemyDamage').replace('{n}', pct(effect.enemyDamage)));
    return parts.join(', ');
  }

  function openShrine(events: SimaEvents): void {
    const pact = events.shrine.pacts.find((p) => p.id === world.simaEvent?.pact);
    if (!pact) return;
    // The curse as it will bite at this difficulty (nightmare: harder).
    const curse = pactEffects(pact, worldDifficulty(world), events);
    showChoice(t('sima.shrine.title'), t('sima.shrine.hint').replace('{floors}', String(events.shrine.floors)), [
      { name: t(`sima.pact.${pact.id}.name`), description: `${t('sima.shrine.blessing')}: ${effectText(pact.blessing)}. ${t('sima.shrine.curse')}: ${effectText({ enemySpeed: curse.enemySpeed, enemyDamage: curse.enemyDamage })}.`, look: 'rare' },
      { name: t('sima.shrine.decline'), description: t('sima.shrine.declineText'), look: 'common' },
    ], (index) => {
      if (index === 0) {
        const taken = acceptPact(world, events, worldDifficulty(world));
        world = taken.world;
        if (taken.bonusMs > 0 && run.clockMs !== undefined && !shrineTimePaid) {
          const before = run.clockMs;
          const after = addTime(before, taken.bonusMs);
          run = { ...run, clockMs: after };
          watchClock(undefined, after - before, 'shrine');
          shrineTimePaid = true;
        }
        audio?.play('levelUp');
      } else world = declinePact(world);
      hideChoice();
    });
  }

  function openMerchant(events: SimaEvents): void {
    const { merchant } = events;
    const item = merchantSold ? null : merchantItem(run.seed, run.floor, world.localId, world.player.items);
    const coins = coinsInHand();
    const price = (n: number) => t('sima.merchant.price').replace('{n}', String(n));
    showChoice(t('sima.merchant.title'), t('sima.merchant.hint').replace('{coins}', String(Math.max(0, coins))), [
      {
        name: t('sima.merchant.berry'),
        description: `${t('sima.merchant.berryText').replace('{n}', String(Math.round(merchant.berryHeal * 100)))} ${price(merchant.berryPrice)}`,
        look: 'uncommon',
        disabled: coins < merchant.berryPrice || merchantBerries >= merchant.berries,
      },
      {
        name: item ? t(`item.${item}`) : t('sima.merchant.soldOut'),
        description: item ? `${t(`item.${item}.description`)} ${price(merchant.itemPrice)}` : '',
        look: 'rare',
        disabled: !item || coins < merchant.itemPrice,
      },
      { name: t('sima.merchant.leave'), description: t('sima.merchant.leaveText'), look: 'common' },
    ], (index) => {
      if (index === 0) {
        simaSpent += merchant.berryPrice;
        merchantBerries++;
        world = { ...world, player: eatBought(world.player, merchant.berryHeal) };
        audio?.play('berry');
        say(t('sima.log.merchant.berry'), 'item');
      } else if (index === 1 && item) {
        simaSpent += merchant.itemPrice;
        merchantSold = true;
        world = { ...world, player: addItem(world.player, item) };
        audio?.play('item');
        say(itemPickedText(world.player.species, item), 'item');
      }
      hideChoice();
    });
  }

  /** Each step: tells the log what the floor's event did, records it, hands out its item pick, and opens the shrine or merchant on reaching them. */
  function watchSimaEvent(): void {
    const events = dungeonOf(run).endless?.events;
    if (!events) return;
    const now = world.simaEvent;
    for (const key of simaNews(lastEvent, now)) say(t(key), 'warn');
    if (now?.done && now.outcome && lastEvent && !lastEvent.done && lastEvent.kind === now.kind) {
      simaLog.push({ floor: run.floor, kind: now.kind, outcome: now.outcome });
      if (rewardsItems(now) && !eventRewarded) {
        eventRewarded = true;
        run = { ...run, offer: rewardOffer(run.seed, run.floor, world.localId, world.player.items) };
        offerPick();
      }
    }
    lastEvent = now;
    if (closeChoice || closePick || closeMenu || closeCinematic || ended) return;
    const atShrine = nearSimaEvent(world, events, 'shrine');
    const atMerchant = nearSimaEvent(world, events, 'merchant');
    if (!atShrine && !atMerchant) {
      choiceDismissed = false;
      return;
    }
    if (choiceDismissed) return;
    choiceDismissed = true;
    // The shrine's pact binds the whole group: the host decides.
    if (atShrine && net?.role === 'guest') say(t('sima.shrine.hostDecides'), 'warn');
    else if (atShrine) openShrine(events);
    else openMerchant(events);
  }

  function hidePick(): void {
    if (!closePick) return;
    closePick();
    closePick = null;
    if (!net && !closeMenu) input.setSuspended(false);
  }

  /** Takes card `index` of the floor's offer; "Restart floor" keeps the item. */
  function choose(index: number): void {
    if (!closePick) return;
    const item = run.offer?.[index];
    const picked = chooseItem(run, world, index);
    if (picked.run === run) return;
    floorStart = chooseItem(run, floorStart, index).world;
    run = picked.run;
    world = picked.world;
    audio?.play('item');
    if (item) say(itemPickedText(world.player.species, item), 'item');
    hidePick();
  }

  /** Shows the current floor's held item offer, if any. */
  function offerPick(): void {
    hidePick();
    if (!run.offer || run.offer.length === 0 || ended) return;
    // Solo: menu clicks must not attack and held keys must not stick (the game pauses meanwhile).
    if (!net) input.setSuspended(true);
    closePick = openItemPick(overlayParent, pickCards(run.offer, world.player.items), Boolean(net), choose);
  }

  function restartFloor(): void {
    hideMenu();
    // A shared run cannot rewind one peer; harder tiers allow fewer restarts per floor.
    if (net || restartsLeft(difficulty, restartsUsed) === 0) return;
    restartsUsed += 1;
    world = { ...floorStart, lock: configureLock(floorStart.lock, lockSettings) };
    tally = floorStartTally;
    simaSpent = floorStartSpent;
    merchantBerries = 0;
    merchantSold = false;
    lastEvent = world.simaEvent;
    hideChoice();
    prev = world;
    accumulator = 0;
    juice = initialJuice();
    lastHurtAt = Number.NEGATIVE_INFINITY;
    defeatedAt.clear();
    lastInput = null;
    camera = world.player.pos;
    announceFloor(false);
  }

  function showMenu(): void {
    if (closeMenu || ended || !options.openMenu) return;
    // Release everything held: menu clicks must not attack, and keys held now must not stick.
    input.setSuspended(true);
    audio?.setDucked(true);
    closeMenu = options.openMenu(
      {
        resume: hideMenu,
        restart: restartFloor,
        ...(net ? {} : { restartsLeft: restartsLeft(difficulty, restartsUsed) }),
        quit: () => {
          hideMenu();
          net?.session.leave();
          options.onQuit?.();
        },
      },
      heldItems(world.player.items),
    );
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    // The shrine's or merchant's choice: 1/2/3 pick, Esc walks away.
    if (closeChoice && !closeMenu && (e.code === 'Escape' || pickIndexForKey(e.code, 3) !== null)) {
      e.preventDefault();
      if (e.code === 'Escape') hideChoice();
      else choicePick?.(pickIndexForKey(e.code, 3)!);
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      if (closeMenu) hideMenu();
      else showMenu();
    } else if (e.code === 'F3' && overlay) {
      // F3 would open the browser's find bar.
      e.preventDefault();
      overlay.toggle();
    } else if (closePick && !closeMenu && pickIndexForKey(e.code, run.offer?.length ?? 0) !== null) {
      choose(pickIndexForKey(e.code, run.offer?.length ?? 0)!);
    } else if (e.code === 'KeyM' && !closeMenu) options.onToggleMute?.();
    else if (e.code === 'Tab' && !closeMenu) {
      // Tab would move the page focus; here it shows or hides the minimap.
      e.preventDefault();
      showMinimap = !showMinimap;
    }
  };

  function resize(): void {
    // Desktop: integer scale as before; touch: fills the screen (src/adapters/fit.ts).
    pixelScale = fitCanvasToWindow(canvas, VIEW_WIDTH, VIEW_HEIGHT, isTouchUi());
    // The HUD scale follows the window on desktop (small panels on big screens), the canvas on touch.
    hudScale = hudScaleFor(window.innerWidth, window.innerHeight, pixelScale, isTouchUi());
  }

  /** The guardian of this floor, if it has a cinematic. */
  const guardianHere = (): SpeciesId | null => {
    if (!isBossFloor(run)) return null;
    const boss = world.enemies.find((e) => GUARDIAN_CINEMATICS[e.species]);
    return boss ? boss.species : null;
  };

  /**
   * Before or after a guardian fight: solo plays the cinematic (the run stands
   * still and input is cut off until it ends), a shared run shows the name
   * card over the running game. `then` runs once it is over.
   */
  function guardianMoment(phase: CinematicPhase, then: () => void): void {
    const species = guardianHere();
    if (!species) return then();
    if (net || !options.playCinematic) {
      intro = { name: t(`species.${species}`), subtitle: t(`guardian.${species}.title`), shownAtMs: realMs };
      return then();
    }
    input.setSuspended(true);
    audio?.setDucked(true);
    closeCinematic = options.playCinematic({ species, phase }, () => {
      closeCinematic = null;
      audio?.setDucked(false);
      if (!closeMenu && !closePick) input.setSuspended(false);
      lastFrame = performance.now();
      then();
    });
    if (!closeCinematic) {
      audio?.setDucked(false);
      input.setSuspended(false);
      then();
    }
  }

  function end(result: GameResult): void {
    if (ended) return;
    ended = true;
    hidePick();
    audio?.setMusic(null);
    // What the merchant took comes off the pay.
    const coins = spendCoins(scaleCoins(coinBreakdown(tally, result, difficulty), dungeonOf(run).endless?.coinScale ?? 1), simaSpent);
    const finish = () =>
      options.onEnd(result, {
        dungeon: run.dungeon,
        floor: run.floor,
        seed: run.seed,
        level: world.player.level,
        items: world.player.items,
        coins,
        difficulty,
        ...(run.clockMs !== undefined ? { clockMs: run.clockMs } : {}),
        ...(simaLog.length > 0 ? { simaEvents: [...simaLog] } : {}),
      });
    // Let the last hit land on screen before the result screen; a fallen guardian has its last words first.
    window.setTimeout(() => {
      if (result !== 'victory' || !guardianHere()) return finish();
      guardianMoment('post', () => (net || !options.playCinematic ? window.setTimeout(finish, CARD_MS) : finish()));
    }, 700);
  }

  function enterFloor(next: { run: RunState; world: WorldState }): void {
    const left = floorPlanOf(run);
    tally = tallyFloor(tally, run.floor, next.run.escape?.floor === run.floor ? next.run.escape.ms : null, left.kind === 'room' && left.role === 'midboss');
    floorStartTally = tally;
    run = next.run;
    world = next.world;
    floorStart = world;
    restartsUsed = 0;
    hideChoice();
    floorStartSpent = simaSpent;
    merchantBerries = 0;
    merchantSold = false;
    shrineTimePaid = false;
    eventRewarded = false;
    lastEvent = world.simaEvent;
    prev = world;
    camera = world.player.pos;
    defeatedAt.clear();
    music();
    announceFloor(true);
    // The guardian's floor opens with its cinematic; the held item pick waits for it.
    guardianMoment('pre', offerPick);
  }

  function simulate(frameMs: number): void {
    const clock = advanceClock(accumulator, frameMs);
    accumulator = clock.accumulatorMs;
    for (let i = 0; i < clock.steps; i++) {
      const keys = toPlayerInput(input.take(), view, pixelScale);
      const touchInput = touchToPlayerInput(touch.take(), {
        view,
        pixelScale,
        playerPos: world.player.pos,
        facing: world.player.facing,
        enemies: world.enemies,
        lockType: world.lock.lockType,
        locked: world.lock.targetId !== null,
        autoAim: options.touch?.autoAim() ?? true,
      });
      const raw = mergeInputs(keys, touchInput);
      const playerInput = net && world.player.hp <= 0 ? idleInput(raw) : raw;
      moving = length(playerInput.move) > 0;
      lastInput = playerInput;
      prev = world;
      let netEvents: GameEvent[] = [];
      if (net) {
        const synced = net.session.beforeStep(world, run.floor);
        world = synced.world;
        netEvents = synced.events;
      }
      const before = world;
      world = step(world, playerInput, FIXED_DT_MS);
      // The endless dungeon's clock runs in simulated time (it stands still with a paused solo run); the host's is the one that counts.
      const clockBefore = run.clockMs;
      // Guests run their copy too, for a smooth display; the host's clock (`takeClock`) corrects it and decides the end.
      run = tickRunClock(run, FIXED_DT_MS);
      if (net && run.clockMs !== undefined) {
        if (net.role === 'host') {
          clockSentMs += FIXED_DT_MS;
          if (clockSentMs >= CLOCK_SEND_MS || run.clockMs <= 0) {
            clockSentMs = 0;
            net.session.sendClock(run.clockMs, run.floor);
          }
        } else {
          const hostClock = net.session.takeClock();
          if (hostClock) run = setClock(run, hostClock.ms);
          if (hostClock && hostClock.ms <= 0) end('eclipse');
        }
      }
      watchClock(clockBefore);
      tally = tallyStep(tally, before, world, FIXED_DT_MS);
      net?.session.afterStep(world, run.floor);
      const events = netEvents.length > 0 ? [...netEvents, ...world.events] : world.events;
      juice = applyEvents(juice, events, world.player.pos);
      audio?.handleEvents(events);
      if (isTouchUi() && options.touch?.haptics()) {
        const pulse = hapticPulse(events);
        if (pulse !== null) vibrate(pulse);
      }
      for (const line of eventMessages(events, (id) => world.enemies.find((e) => e.id === id)?.species ?? null, world.player.species)) say(line.text, line.tone);
      for (const event of events) {
        if (event.type === 'playerHurt' || event.type === 'disguiseBroken' || event.type === 'collapseHurt') lastHurtAt = realMs;
        if (event.type === 'enemyDefeated') defeatedAt.set(event.enemyId, realMs);
        if (event.type === 'berryEaten' && event.berryId.includes(WISP_BERRY) && !wispFound) {
          wispFound = true;
          say(t('forest.wisp.found'), 'good');
        }
      }
      const progress = progressRun(run, world);
      // An echo's time bonus changes the run without a floor change (entering a floor goes through enterFloor below).
      if (!progress.entered) run = progress.run;
      // Why the time came: a new floor, a felled echo, the crystal or a cleared wave room.
      const plan = floorPlanOf(run);
      const reason = progress.entered ? 'descend' : plan.kind === 'room' && plan.role === 'echo' ? 'echo' : world.simaEvent?.kind;
      watchClock(undefined, progress.bonusMs, reason);
      const hostFloor = net?.role === 'guest' ? net.session.takeFloorChange() : null;
      if (progress.outcome) end(progress.outcome);
      else if (progress.entered) {
        enterFloor(progress);
        if (net) net.session.sendFloor(run.floor);
        if (net && run.clockMs !== undefined) net.session.sendClock(run.clockMs, run.floor);
      } else if (hostFloor !== null && hostFloor > run.floor) enterFloor(followToFloor(run, world, hostFloor));
      else watchSimaEvent();
      if (juice.hitstopMs > 0) {
        // Hitstop: freeze the simulation from this step on; drop the backlog.
        accumulator = 0;
        break;
      }
    }
  }

  function frame(now: number): void {
    // Paused: no game time at all (animations, juice and the clock stand still); resuming does not catch up.
    // A shared run never pauses: the others keep playing.
    const paused =
      simulationPaused(closeMenu !== null, !net) || pickPausesSimulation(closePick !== null, Boolean(net)) || closeCinematic !== null || pickPausesSimulation(closeChoice !== null, Boolean(net));
    const time = frameTime(lastFrame, now, paused);
    const frameMs = time.frameMs;
    lastFrame = time.lastFrameMs;
    realMs += frameMs;
    resize();
    const frozen = juice.hitstopMs > 0;
    juice = tickJuice(juice, frameMs);
    log = pruneLog(log, realMs);
    if (!frozen && !(ended && world.player.hp <= 0)) simulate(frameMs);

    const alpha = frozen ? 1 : accumulator / FIXED_DT_MS;
    camera = followCamera(camera, lerpVec(prev.player.pos, world.player.pos, alpha), frameMs);
    view = cameraView(camera, VIEW_WIDTH, VIEW_HEIGHT, world.arena);
    if (minimap && world.arena.tiles) revealAround(minimap, world.arena.tiles, world.arena.rooms ?? [], tileOf(world.player.pos), world.fog ? fogRadiusTiles(world.fog) : undefined);
    const bar = bossBar(world);
    // A boss spell card (Decidueye, Sableye, Aegislash's phase 2) shows its name once when it starts.
    const cardKey = bar ? spellCardKey(bar.species, bar.stance) : null;
    const cardNow = cardKey && world.enemies.some((e) => e.id === bar!.enemyId && e.ai.mode !== 'approach' && e.ai.mode !== 'idle') ? bar!.stance : null;
    if (cardNow && cardKey && cardNow !== lastCard) spell = { name: t(cardKey), shownAtMs: realMs };
    if (cardNow) lastCard = cardNow;
    // The rumble stops while paused or after the run ends.
    const rumble = closeMenu || ended ? 0 : rumbleLevel(collapseProximity(world));
    audio?.setRumble(rumble);
    const plan = floorPlanOf(run);
    const exit = roomExit(plan, dungeonOf(run));
    const band = simaBand();
    // Click-to-lock hover: the enemy a click would lock (same rule as the core).
    const hovered =
      clickLockActive(world.lock) && !closeMenu && lastInput
        ? enemyUnderCursor({ playerPos: world.player.pos, cursor: lastInput.aim, view: lastInput.view, enemies: world.enemies })
        : null;
    renderer.draw({
      prev,
      current: world,
      alpha,
      juice,
      view,
      pixelScale,
      hudScale,
      floor: run.floor,
      exit,
      exitOpen: exit !== null && roomCleared(world),
      timeMs: realMs,
      sinceHurtMs: realMs - lastHurtAt,
      defeatedAt,
      moving,
      hoverId: hovered && hovered.id !== world.lock.targetId ? hovered.id : null,
      card,
      rumble,
      minimap: showMinimap ? minimap : null,
      log,
      coins: Math.max(0, coinsInHand()),
      // The Sima's look follows its depth band (palette, decoration, backdrop, abyss).
      palette: band ? simaPalette(band) : dungeonOf(run).palette,
      decor: band ? (band.decor ?? null) : (dungeonOf(run).decor ?? null),
      sima: band ? { floor: run.floor, abyss: band.abyss === true } : null,
      intro,
      nowPlaying,
      spell,
      clock: run.clockMs !== undefined ? { ms: run.clockMs, lowMs, bonus: clockBonus } : null,
      touchUi: isTouchUi(),
      ...(net ? { names: rosterNames(net.session.roster()) } : {}),
    });
    overlay?.update(realMs);
    raf = requestAnimationFrame(frame);
  }

  resize();
  music();
  lastEvent = world.simaEvent;
  announceFloor(false);
  // Development start below floor 1 (`?floor=`): that floor's offer (after the guardian's cinematic on its floor).
  guardianMoment('pre', offerPick);
  window.addEventListener('keydown', onKeyDown);
  raf = requestAnimationFrame(frame);
  return {
    setLock(settings) {
      lockSettings = settings;
      world = { ...world, lock: configureLock(world.lock, settings) };
    },
    stop() {
      closeMenu?.();
      closeMenu = null;
      closePick?.();
      closePick = null;
      closeChoice?.();
      closeChoice = null;
      closeCinematic?.();
      closeCinematic = null;
      audio?.setDucked(false);
      audio?.setRumble(0);
      cancelAnimationFrame(raf);
      input.dispose();
      releaseWakeLock();
      // A room's session outlives its run: the room goes back to the town together.
      if (!net?.keepSession) net?.session.leave();
      overlay?.dispose();
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}
