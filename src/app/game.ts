import type { ItemId } from '../data/items';
import type { MoveId } from '../data/moves';
import type { SpeciesId } from '../data/species';
import type { UpgradeLevels } from '../data/upgrades';
import { roomCleared } from '../core/rooms';
import { collapseProximity } from '../core/collapse';
import { chooseItem, dungeonOf, floorPlanOf, followToFloor, isBossFloor, progressRun, roomExit, setClock, startRun, tickRunClock, type RunState } from '../core/run';
import { runUpgrades, scaleCoins } from '../core/endless';
import { tickDue, type RunClock } from '../adapters/clock-hud';
import { GUARDIAN_CINEMATICS, type CinematicPhase } from '../data/guardian-cinematics';
import { CARD_MS } from './guardian-cinematic';
import { dungeonById, musicFor, type DungeonId } from '../data/dungeons';
import type { MusicContext } from '../data/music';
import { trackNote, type DungeonIntro, type NowPlaying, type SpellBanner } from '../adapters/intro-card';
import { bossBar } from '../core/boss';
import { fogRadiusTiles } from '../core/fog';
import { ENEMY_BEHAVIOUR } from '../data/enemies';
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
import { openItemPick, pickCards, pickIndexForKey, pickPausesSimulation } from './item-pick';
import { simulationPaused, type MenuActions } from './menu';
import { createNetOverlay } from './net-overlay';

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
  /** Development only: start on this floor of the run (`?floor=` on the dev server). */
  startFloor?: number;
  /** Development only: the endless clock starts at this many ms (`?clock=` on the dev server). */
  startClockMs?: number;
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
  net?: { session: NetSession; role: 'host' | 'guest'; localId: string };
  /** Touch settings, read live (src/adapters/touch.ts); the on-screen controls exist only while `html.touch` is set. */
  touch?: { autoAim(): boolean; haptics(): boolean };
}

/** What a fainted player sends in a shared run: nothing (no revive in the spike). */
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
      ...(net ? { localId: net.localId, role: net.role } : {}),
    },
    options.startFloor,
    options.dungeon,
  );
  let run: RunState = options.startClockMs !== undefined && started.run.clockMs !== undefined ? setClock(started.run, options.startClockMs) : started.run;
  let world: WorldState = started.world;
  let lockSettings = { lockType: options.lockType, clickToLock: options.clickToLock };
  /** World as the current floor was entered, for "Restart floor". */
  let floorStart = world;
  /** Pokémonedas tally of the run, and as the current floor was entered ("Restart floor" must not pay twice). */
  let tally: CoinTally = emptyTally();
  let floorStartTally = tally;
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
  /** Endless: the last time added to the run clock, shown under it for a moment. */
  let clockBonus: RunClock['bonus'] = null;
  const lowMs = dungeonOf(run).endless?.clock.lowMs ?? 0;
  /** Endless: a tick every second once the clock is low, and "+N s" when time is added. */
  const watchClock = (beforeMs: number | undefined, bonusMs = 0) => {
    if (bonusMs > 0) clockBonus = { ms: bonusMs, shownAtMs: realMs };
    if (beforeMs !== undefined && run.clockMs !== undefined && tickDue(beforeMs, run.clockMs, lowMs)) audio?.play('click');
  };
  /** Title card of the current floor; game input keeps working while it shows. */
  let card: FloorCard | null = null;
  /** Fog-of-war memory of the current floor's minimap (presentation state; reset on each floor and on restart). */
  let minimap: MinimapMemory | null = null;
  let showMinimap = true;
  /** Message log at the bottom left, on the real (pause-aware) clock. */
  let log: MessageLog = emptyLog();
  const say = (text: string, tone: LogTone) => (log = pushMessage(log, text, tone, realMs));
  function announceFloor(descended: boolean): void {
    const lore = dungeonOf(run).lore;
    card = { dungeon: t(lore.nameKey), floor: run.floor, kind: run.kind, escape: run.escape, shownAtMs: realMs };
    // Floor 1 opens with the dungeon's own title instead of the floor card (Touhou-style stage title).
    if (run.floor === 1) {
      intro = { name: t(lore.nameKey), subtitle: t(lore.subtitleKey), shownAtMs: realMs };
      card = null;
    }
    if (run.kind !== 'normal') say(t(`card.${run.kind}`), 'warn');
    // A guardian echo of the endless dungeon: only a short name card, no cinematic.
    const plan = floorPlanOf(run);
    const echo = plan.kind === 'room' && plan.role === 'echo' ? world.enemies[0] : undefined;
    if (echo) {
      // The echo's name card replaces the floor card (they would overlap).
      intro = { name: t(`species.${echo.species}`), subtitle: t('endless.echo').replace('{floor}', String(run.floor)), shownAtMs: realMs };
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
    // A shared run cannot rewind one peer.
    if (net) return;
    world = { ...floorStart, lock: configureLock(floorStart.lock, lockSettings) };
    tally = floorStartTally;
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
    const coins = scaleCoins(coinBreakdown(tally, result), dungeonOf(run).endless?.coinScale ?? 1);
    const finish = () =>
      options.onEnd(result, {
        dungeon: run.dungeon,
        floor: run.floor,
        seed: run.seed,
        level: world.player.level,
        items: world.player.items,
        coins,
        ...(run.clockMs !== undefined ? { clockMs: run.clockMs } : {}),
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
      if (net?.role !== 'guest') run = tickRunClock(run, FIXED_DT_MS);
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
      }
      const progress = progressRun(run, world);
      // An echo's time bonus changes the run without a floor change (entering a floor goes through enterFloor below).
      if (!progress.entered) run = progress.run;
      watchClock(undefined, progress.bonusMs);
      const hostFloor = net?.role === 'guest' ? net.session.takeFloorChange() : null;
      if (progress.outcome) end(progress.outcome);
      else if (progress.entered) {
        enterFloor(progress);
        if (net) net.session.sendFloor(run.floor);
      } else if (hostFloor !== null && hostFloor > run.floor) enterFloor(followToFloor(run, world, hostFloor));
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
    const paused = simulationPaused(closeMenu !== null, !net) || pickPausesSimulation(closePick !== null, Boolean(net)) || closeCinematic !== null;
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
    const def = bar ? ENEMY_BEHAVIOUR[bar.species] : undefined;
    const cardNow = def?.kind === 'archer' && bar?.stance && world.enemies.some((e) => e.id === bar.enemyId && e.ai.mode !== 'approach' && e.ai.mode !== 'idle') ? bar.stance : null;
    if (cardNow && cardNow !== lastCard && def?.kind === 'archer') spell = { name: t(def.cardNames[cardNow as keyof typeof def.cardNames]), shownAtMs: realMs };
    if (cardNow) lastCard = cardNow;
    // The rumble stops while paused or after the run ends.
    const rumble = closeMenu || ended ? 0 : rumbleLevel(collapseProximity(world));
    audio?.setRumble(rumble);
    const plan = floorPlanOf(run);
    const exit = roomExit(plan, dungeonOf(run));
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
      coins: scaleCoins(coinBreakdown(tally, null), dungeonOf(run).endless?.coinScale ?? 1).total,
      palette: dungeonOf(run).palette,
      intro,
      nowPlaying,
      spell,
      clock: run.clockMs !== undefined ? { ms: run.clockMs, lowMs, bonus: clockBonus } : null,
      touchUi: isTouchUi(),
    });
    overlay?.update(realMs);
    raf = requestAnimationFrame(frame);
  }

  resize();
  music();
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
      closeCinematic?.();
      closeCinematic = null;
      audio?.setDucked(false);
      audio?.setRumble(0);
      cancelAnimationFrame(raf);
      input.dispose();
      releaseWakeLock();
      net?.session.leave();
      overlay?.dispose();
      window.removeEventListener('keydown', onKeyDown);
    },
  };
}
