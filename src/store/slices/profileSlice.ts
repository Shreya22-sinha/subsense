/** Profile actions: quiz, budget, preferences, onboarding (PRD 6.4, 6.12). */
import { scoreQuiz } from '@/engine/quizScoring';
import { emptyUserData } from '@/engine/userData';
import { formatRs } from '@/lib/format';
import type { Paise, Profile, QuizAnswers } from '@/types/models';
import type { DataSlice } from './types';

export interface ProfileSlice {
  setQuizAnswer: <K extends keyof QuizAnswers>(key: K, value: QuizAnswers[K]) => void;
  /** Recompute interest scores and flags from the saved answers (PRD 7.7.1). */
  applyQuiz: (opts: { retake: boolean }) => void;
  setBudget: (paise: Paise, opts?: { log?: boolean }) => void;
  updatePreferences: (
    prefs: Partial<Pick<Profile, 'theme' | 'isStudent' | 'defaultReminderDays'>>,
  ) => void;
  completeOnboarding: () => void;
  /** Settings > Clear all my data: wipe this user's data (the account stays). */
  clearAllData: () => void;
  /** Settings > Export CSV: record that an export happened. */
  logDataExported: (count: number) => void;
}

export const createProfileSlice: DataSlice<ProfileSlice> = (set, get) => ({
  setQuizAnswer: (key, value) =>
    set({
      profile: { ...get().profile, quizAnswers: { ...get().profile.quizAnswers, [key]: value } },
    }),

  applyQuiz: ({ retake }) => {
    set({ profile: { ...get().profile, ...scoreQuiz(get().profile.quizAnswers) } });
    if (retake) get().logActivity('quiz_retaken', 'You retook the quiz. Your picks will update.');
  },

  setBudget: (paise, opts) => {
    const previous = get().profile.budgetPaise;
    set({ profile: { ...get().profile, budgetPaise: paise } });
    if (opts?.log && previous !== paise) {
      get().logActivity(
        'budget_changed',
        `You changed your monthly budget to ${formatRs(paise)}.`,
        {
          data: { from: previous, to: paise },
        },
      );
    }
  },

  updatePreferences: (prefs) => set({ profile: { ...get().profile, ...prefs } }),

  completeOnboarding: () => {
    get().applyQuiz({ retake: false });
    set({ profile: { ...get().profile, onboardingDone: true } });
    get().logActivity('onboarding_completed', 'You finished setting up SubSense.');
  },

  clearAllData: () => {
    // Keep only the theme so the screen doesn't flash to another theme.
    const theme = get().profile.theme;
    const fresh = emptyUserData();
    set({ ...fresh, profile: { ...fresh.profile, theme } });
    get().logActivity('data_cleared', 'You cleared all your data.');
  },

  logDataExported: (count) =>
    get().logActivity('data_exported', `You exported ${count} subscriptions to CSV.`, {
      data: { count },
    }),
});
