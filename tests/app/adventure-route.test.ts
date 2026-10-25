import { describe, expect, it } from 'vitest';
import { nextAdventureScreen } from '../../src/app/adventure-route';
import { defaultSettings, withStarter } from '../../src/app/settings';
import { STARTERS } from '../../src/data/quiz';
import { isPlayable } from '../../src/data/species';

describe('new adventure routing', () => {
  it('opens with the prologue the first time, whatever the starter', () => {
    expect(nextAdventureScreen({ prologueSeen: false, starterChosen: false })).toBe('prologue');
    expect(nextAdventureScreen({ prologueSeen: false, starterChosen: true })).toBe('prologue');
  });

  it('runs the quiz after the prologue while no starter is chosen', () => {
    expect(nextAdventureScreen({ prologueSeen: true, starterChosen: false })).toBe('quiz');
  });

  it('goes straight to the loadout once both are done', () => {
    expect(nextAdventureScreen({ prologueSeen: true, starterChosen: true })).toBe('loadout');
  });

  it('walks prologue, quiz, loadout as each step is marked done', () => {
    const state = { prologueSeen: false, starterChosen: false };
    const path: string[] = [];
    for (let step = nextAdventureScreen(state); ; step = nextAdventureScreen(state)) {
      path.push(step);
      if (step === 'loadout') break;
      if (step === 'prologue') state.prologueSeen = true;
      else state.starterChosen = true;
    }
    expect(path).toEqual(['prologue', 'quiz', 'loadout']);
  });

  it('every quiz starter is playable, so its result is the run species with no Mimikyu fallback', () => {
    for (const starter of STARTERS) {
      expect(isPlayable(starter), starter).toBe(true);
      expect(withStarter(defaultSettings('es'), starter).species).toBe(starter);
    }
  });
});
