import { describe, expect, it } from 'vitest';
import { cutShortAction, endActions, endHeading, materialsEarned, quitSession, returnPlace, townOf } from '../../src/app/after-run';
import { startRun } from '../../src/core/run';
import { createSession } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub } from '../../src/net/transport';
import { dungeonById } from '../../src/data/dungeons';
import { setLanguage, t } from '../../src/i18n';

describe('after a run', () => {
  it('a run the host cut short is headed as interrupted, never as the player fainting', () => {
    expect(endHeading('defeat')).toEqual({ title: 'screen.defeat.title', text: 'screen.defeat.text' });
    expect(endHeading('victory')).toEqual({ title: 'screen.victory.title', text: 'screen.victory.text' });
    expect(endHeading('defeat', 'hostLeft')).toEqual({ title: 'screen.cutShort.title', text: null });
    expect(endHeading('defeat', 'closed')).toEqual({ title: 'screen.cutShort.title', text: null });
  });

  it('a solo or local run offers a retry, then the way back to the town', () => {
    expect(endActions({ online: false })).toEqual(['retry', 'town']);
  });

  it('an online run (host or guest) only goes back to the town', () => {
    expect(endActions({ online: true })).toEqual(['town']);
  });

  it('a finished run, a quit from the menu and a host leaving mid-run all lead to the town', () => {
    expect(returnPlace('end')).toBe('town');
    expect(returnPlace('quit')).toBe('town');
    expect(returnPlace('hostLeft')).toBe('town');
  });

  it('leaving a lobby before any run still goes back to the title', () => {
    expect(returnPlace('lobby')).toBe('title');
  });

  it("a room's run brings everyone back to the room's town; any other run comes back to the hub", () => {
    expect(townOf({ inRoom: true })).toBe('room');
    expect(townOf({ inRoom: false })).toBe('hub');
  });

  it('a run the host cuts short (it left, or reopened the town first) ends now as a defeat, flushes an end already due, or does nothing twice', () => {
    // Still playing: it ends at once, paid like a defeat.
    expect(cutShortAction({ ended: false, finished: false })).toBe('end');
    // Ended, its end screen waiting on the last-hit delay or the guardian card: shown now.
    expect(cutShortAction({ ended: true, finished: false })).toBe('finish');
    // Its end already ran (onEnd paid): nothing more.
    expect(cutShortAction({ ended: true, finished: true })).toBe('none');
  });
});

describe('materials on the end screen', () => {
  const challenge = dungeonById('challenge-abra');
  const before = { materials: { abra: { normal: 2 } } };
  const after = { materials: { abra: { normal: 5 } } };

  it('names what a challenge clear paid: count, line and tier', () => {
    setLanguage('es');
    expect(materialsEarned(challenge, 'normal', before, after, t)).toBe('+3 Esencias de Abra (Normal)');
    setLanguage('en');
    expect(materialsEarned(challenge, 'normal', before, after, t)).toBe('+3 Abra Essence (Normal)');
  });

  it('says nothing when nothing was paid (Easy, a defeat, a peer without the line, a main dungeon)', () => {
    expect(materialsEarned(challenge, 'easy', before, before, t)).toBeNull();
    expect(materialsEarned(challenge, 'hard', before, before, t)).toBeNull();
    expect(materialsEarned(dungeonById('crypt'), 'normal', before, after, t)).toBeNull();
  });

  // Ticket SD-RIKZIZ: "Salir al menú" in a room's run threw the player out of the room.
  describe('quitting a shared run from the Esc menu', () => {
    const LOADOUT = ['shadow-claw', 'play-rough'] as const;
    function room() {
      const scheduler = createFakeScheduler();
      const hub = createMemoryHub<string>();
      const host = createSession({ transport: hub.connect('h'), scheduler });
      const guest = createSession({ transport: hub.connect('a'), scheduler });
      let hostLeft = 0;
      guest.onHostLeft(() => hostLeft++);
      host.host(5, 1, 'mimikyu', { lobby: true });
      guest.join('mimikyu', LOADOUT);
      host.begin();
      host.afterStep(startRun(42, { localId: 'p1', role: 'host' }).world, 1);
      return { host, guest, hostLeft: () => hostLeft };
    }

    it('a guest of an online room leaves the run but stays in the room (held for the next join point)', () => {
      const r = room();
      quitSession({ session: r.guest, role: 'guest', keepSession: true });
      expect(r.host.roster().map((e) => e.peer)).toEqual(['h']);
      expect(r.guest.held()).toBe(true);
      // Still connected: the next floor lets it back in.
      r.host.sendFloor(2);
      expect(r.host.roster().map((e) => e.peer)).toEqual(['h', 'a']);
    });

    it('the host of an online room keeps the session (the room goes back to the town together)', () => {
      const r = room();
      quitSession({ session: r.host, role: 'host', keepSession: true });
      expect(r.hostLeft()).toBe(0);
      expect(r.host.roster().map((e) => e.peer)).toEqual(['h', 'a']);
    });

    it('a session that does not outlive its run (local tabs) is left as before', () => {
      const r = room();
      quitSession({ session: r.host, role: 'host' });
      expect(r.hostLeft()).toBe(1);
      const s = room();
      quitSession({ session: s.guest, role: 'guest', keepSession: false });
      expect(s.host.roster().map((e) => e.peer)).toEqual(['h']);
      expect(s.guest.held()).toBe(false);
    });

    it('a solo run has no session to leave', () => {
      expect(() => quitSession(undefined)).not.toThrow();
    });
  });
});
