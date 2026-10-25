/**
 * The personality quiz (docs/gdd.md §3, opening): a voice asks a few questions
 * in the dark, each answer adds points to natures, and the winning nature
 * decides the Pokémon you wake up as. Questions are original. Text lives in
 * i18n under `quiz.q.<id>` (question) and `quiz.q.<id>.a1..a3` (answers);
 * natures under `quiz.nature.<id>` and `quiz.nature.<id>.text`.
 *
 * Balance: every nature is the main (2-point) answer of exactly three
 * answers in the pool, and the 1-point answers spread evenly too.
 */
export const NATURES = ['brave', 'calm', 'hardy', 'jolly', 'lonely', 'quirky', 'sassy', 'timid'] as const;
export type NatureId = (typeof NATURES)[number];

/**
 * Starters the quiz can hand out, as plain ids (data stays free of the
 * species table). Every one is a playable species; a test enforces it.
 */
export const STARTERS = ['mimikyu', 'zorua', 'litwick', 'cubone'] as const;
export type StarterId = (typeof STARTERS)[number];

/** Two natures per starter: Mimikyu (lonely, timid), Zorua (quirky, sassy), Litwick (calm, jolly), Cubone (brave, hardy). */
export const NATURE_STARTER: Record<NatureId, StarterId> = {
  lonely: 'mimikyu',
  timid: 'mimikyu',
  quirky: 'zorua',
  sassy: 'zorua',
  calm: 'litwick',
  jolly: 'litwick',
  brave: 'cubone',
  hardy: 'cubone',
};

export interface QuizAnswer {
  points: Partial<Record<NatureId, number>>;
}

export interface QuizQuestion {
  id: string;
  answers: readonly [QuizAnswer, QuizAnswer, QuizAnswer];
}

const a = (points: Partial<Record<NatureId, number>>): QuizAnswer => ({ points });

export const QUIZ_QUESTIONS: readonly QuizQuestion[] = [
  { id: 'lantern', answers: [a({ brave: 2, hardy: 1 }), a({ calm: 2, timid: 1 }), a({ jolly: 2, quirky: 1 })] },
  { id: 'mask', answers: [a({ quirky: 2, sassy: 1 }), a({ hardy: 2, brave: 1 }), a({ lonely: 2, timid: 1 })] },
  { id: 'friend', answers: [a({ calm: 2, lonely: 1 }), a({ sassy: 2, jolly: 1 }), a({ brave: 2, hardy: 1 })] },
  { id: 'mirror', answers: [a({ sassy: 2, quirky: 1 }), a({ timid: 2, calm: 1 }), a({ quirky: 2, lonely: 1 })] },
  { id: 'storm', answers: [a({ hardy: 2, brave: 1 }), a({ jolly: 2, quirky: 1 }), a({ lonely: 2, calm: 1 })] },
  { id: 'keepsake', answers: [a({ hardy: 2, lonely: 1 }), a({ calm: 2, timid: 1 }), a({ sassy: 2, jolly: 1 })] },
  { id: 'voice', answers: [a({ brave: 2, sassy: 1 }), a({ timid: 2, quirky: 1 }), a({ jolly: 2, lonely: 1 })] },
  { id: 'wish', answers: [a({ lonely: 2, calm: 1 }), a({ timid: 2, brave: 1 }), a({ quirky: 2, sassy: 1 })] },
];

/** Questions asked per run, picked at random (seeded) from the pool. */
export const QUIZ_LENGTH = 6;
