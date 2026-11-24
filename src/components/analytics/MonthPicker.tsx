import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthLabel, shiftMonth, type MonthKey } from '@/engine/insights';

/** Previous / next month; can't go past the demo's current month (PRD 6.10). */
export function MonthPicker({
  month,
  min,
  max,
  onChange,
}: {
  month: MonthKey;
  min: MonthKey;
  max: MonthKey;
  onChange: (m: MonthKey) => void;
}) {
  const btn =
    'flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-2 disabled:text-ink-muted/40 disabled:hover:bg-transparent';
  return (
    <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-1">
      <button
        type="button"
        className={btn}
        onClick={() => onChange(shiftMonth(month, -1))}
        disabled={month <= min}
        aria-label="Previous month"
      >
        <ChevronLeft size={22} aria-hidden />
      </button>
      <p className="font-display text-base font-semibold text-ink" aria-live="polite">
        {monthLabel(month)}
      </p>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(shiftMonth(month, 1))}
        disabled={month >= max}
        aria-label="Next month"
      >
        <ChevronRight size={22} aria-hidden />
      </button>
    </div>
  );
}
