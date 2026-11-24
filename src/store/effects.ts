/** Cross-store reactions, started once from main.tsx. */
import { monthlyTotalPaise } from '@/engine/dates';
import { shouldLogBudgetExceeded } from '@/engine/insights';
import { formatRs } from '@/lib/format';
import { getToday, useClockStore } from './clockStore';
import { useDataStore } from './dataStore';

/** Log budget_exceeded once per calendar month when the total goes over budget (PRD 7.2). */
function checkBudget() {
  const s = useDataStore.getState();
  if (!s.profile.onboardingDone) return;
  const total = monthlyTotalPaise(s.subscriptions);
  if (shouldLogBudgetExceeded(total, s.profile.budgetPaise, s.activities, getToday())) {
    s.logActivity(
      'budget_exceeded',
      `You went over your ${formatRs(s.profile.budgetPaise)} budget: ${formatRs(total)}/month.`,
      { data: { totalPaise: total, budgetPaise: s.profile.budgetPaise } },
    );
  }
}

export function startStoreEffects(): () => void {
  // Changing the demo clock runs rollover (PRD 7.1, 9.3).
  const unsubClock = useClockStore.subscribe((state, prev) => {
    if (state.offsetDays !== prev.offsetDays) {
      useDataStore.getState().runRollover();
      checkBudget();
    }
  });
  const unsubData = useDataStore.subscribe((state, prev) => {
    if (state.subscriptions !== prev.subscriptions || state.profile !== prev.profile) checkBudget();
  });
  return () => {
    unsubClock();
    unsubData();
  };
}
