/**
 * Quiz scoring (PRD 7.7.1). Each answer adds points to category interest scores
 * (capped at 100) or sets a profile flag. A score of 40+ counts as an interest.
 */
import {
  CATEGORIES,
  type Category,
  type InterestScores,
  type PricePreference,
  type QuizAnswers,
  type SharesPlans,
} from '@/types/models';

export const INTEREST_THRESHOLD = 40;
const MAX_SCORE = 100;

type Points = Partial<Record<Category, number>>;

/** Points per answer id, keyed by question. Ids match src/data/quiz.ts. */
const POINTS: Record<'q1' | 'q2' | 'q3' | 'q6', Record<string, Points>> = {
  q1: {
    binge: { Video: 40 },
    gaming: { Gaming: 40 },
    reading: { Reading: 40 },
    workout: { Fitness: 40 },
    learning: { Learning: 40 },
    making: { Productivity: 20, Cloud: 20, Music: 10 },
  },
  q2: {
    all_day: { Music: 40 },
    commute: { Music: 20 },
    rarely: {},
  },
  q3: {
    student: { Learning: 10 },
    professional: { Productivity: 20, Cloud: 10 },
    freelancer: { Productivity: 30, Cloud: 20 },
    other: {},
  },
  q6: {
    get_fit: { Fitness: 30 },
    language: { Learning: 30 },
    read_more: { Reading: 30 },
    career: { Learning: 20, Productivity: 20 },
    relax: { Video: 15, Music: 15, Gaming: 10 },
    save_money: {},
  },
};

const SHARES: Record<string, SharesPlans> = {
  often: 'often',
  sometimes: 'sometimes',
  never: 'never',
};
const PRICE_PREF: Record<string, PricePreference> = {
  low: 'low',
  quality: 'quality',
  balanced: 'balanced',
};

export interface QuizResult {
  interestScores: InterestScores;
  isStudent: boolean;
  sharesPlans: SharesPlans;
  pricePreference: PricePreference;
  savingsFocus: boolean;
}

export function emptyInterestScores(): InterestScores {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as InterestScores;
}

export function emptyQuizAnswers(): QuizAnswers {
  return { q1: [], q2: '', q3: '', q4: '', q5: '', q6: [] };
}

/** Skipped questions contribute nothing and leave flags at their neutral defaults. */
export function scoreQuiz(answers: QuizAnswers): QuizResult {
  const scores = emptyInterestScores();
  const add = (points: Points | undefined) => {
    if (!points) return;
    for (const [cat, pts] of Object.entries(points) as [Category, number][]) {
      scores[cat] = Math.min(MAX_SCORE, scores[cat] + pts);
    }
  };

  answers.q1.forEach((id) => add(POINTS.q1[id]));
  add(POINTS.q2[answers.q2]);
  add(POINTS.q3[answers.q3]);
  answers.q6.forEach((id) => add(POINTS.q6[id]));

  return {
    interestScores: scores,
    isStudent: answers.q3 === 'student',
    sharesPlans: SHARES[answers.q4] ?? 'never',
    pricePreference: PRICE_PREF[answers.q5] ?? 'balanced',
    savingsFocus: answers.q6.includes('save_money'),
  };
}

/** Categories the user counts as interested in, highest score first. */
export function interests(scores: InterestScores): Category[] {
  return CATEGORIES.filter((c) => scores[c] >= INTEREST_THRESHOLD).sort(
    (a, b) => scores[b] - scores[a],
  );
}
