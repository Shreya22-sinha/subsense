/** Empty shapes for a user's data blob (PRD 8). */
import type { Profile, UserData } from '@/types/models';
import { emptyInterestScores, emptyQuizAnswers } from './quizScoring';

export function emptyProfile(): Profile {
  return {
    onboardingDone: false,
    quizAnswers: emptyQuizAnswers(),
    interestScores: emptyInterestScores(),
    isStudent: false,
    sharesPlans: 'never',
    pricePreference: 'balanced',
    savingsFocus: false,
    budgetPaise: 200000,
    defaultReminderDays: 3,
    theme: 'system',
  };
}

export function emptyUserData(): UserData {
  return {
    profile: emptyProfile(),
    subscriptions: [],
    usages: [],
    charges: [],
    priceChanges: [],
    savings: [],
    actionStates: [],
    dismissedPicks: [],
    activities: [],
  };
}

/** Shape check for data read from storage; anything else is treated as corrupt. */
export function isUserData(value: unknown): value is UserData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    !!v.profile &&
    typeof v.profile === 'object' &&
    [
      'subscriptions',
      'usages',
      'charges',
      'priceChanges',
      'savings',
      'actionStates',
      'dismissedPicks',
      'activities',
    ].every((k) => Array.isArray(v[k]))
  );
}
