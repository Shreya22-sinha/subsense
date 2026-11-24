/** Budget meter (PRD 7.2). */
import type { Paise } from '@/types/models';

export type BudgetLevel = 'green' | 'amber' | 'red';

export interface BudgetStatus {
  /** monthly total / budget (0 when there is no budget). */
  ratio: number;
  level: BudgetLevel;
  /** budget - monthly total; negative when over. */
  headroomPaise: Paise;
  over: boolean;
}

/** Green under 80%, amber 80% to 100%, red over 100%. */
export function budgetStatus(monthlyTotalPaise: Paise, budgetPaise: Paise): BudgetStatus {
  const ratio = budgetPaise > 0 ? monthlyTotalPaise / budgetPaise : 0;
  const headroomPaise = budgetPaise - monthlyTotalPaise;
  const level: BudgetLevel = ratio > 1 ? 'red' : ratio >= 0.8 ? 'amber' : 'green';
  return { ratio, level, headroomPaise, over: headroomPaise < 0 };
}
