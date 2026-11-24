import { budgetStatus, type BudgetLevel } from '@/engine/budget';
import { cn } from '@/lib/cn';
import { formatRs } from '@/lib/format';
import type { Paise } from '@/types/models';

const BAR: Record<BudgetLevel, string> = {
  green: 'bg-success',
  amber: 'bg-warning',
  red: 'bg-danger',
};

const LEVEL_LABEL: Record<BudgetLevel, string> = {
  green: 'On track',
  amber: 'Getting close',
  red: 'Over budget',
};

/** Budget bar with a text status, so the state is never colour-only (PRD 10). */
export function BudgetMeter({
  totalPaise,
  budgetPaise,
}: {
  totalPaise: Paise;
  budgetPaise: Paise;
}) {
  const status = budgetStatus(totalPaise, budgetPaise);
  const pct = Math.round(status.ratio * 100);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-semibold text-ink">
          {LEVEL_LABEL[status.level]} · {pct}% of {formatRs(budgetPaise)}
        </span>
        <span className={cn('font-semibold', status.over ? 'text-danger-ink' : 'text-ink-muted')}>
          {status.over
            ? `${formatRs(-status.headroomPaise)} over`
            : `${formatRs(status.headroomPaise)} left`}
        </span>
      </div>
      <div
        role="meter"
        aria-label="Budget used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(pct, 100)}
        aria-valuetext={`${pct}% of budget used`}
        className="h-3 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className={cn('h-full rounded-full', BAR[status.level])}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
