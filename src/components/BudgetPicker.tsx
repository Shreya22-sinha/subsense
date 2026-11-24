import { useId, useState } from 'react';
import { BUDGET } from '@/data/quiz';
import { formatRs, paiseToRupees, rupeesToPaise } from '@/lib/format';
import type { Paise } from '@/types/models';

interface BudgetPickerProps {
  valuePaise: Paise;
  onChange: (paise: Paise) => void;
}

const clamp = (paise: number) => Math.min(BUDGET.maxPaise, Math.max(BUDGET.minPaise, paise));

/** Monthly budget: slider (₹500–₹10,000 in ₹100 steps) plus a number input (PRD 6.4 step 7). */
export function BudgetPicker({ valuePaise, onChange }: BudgetPickerProps) {
  const sliderId = useId();
  const inputId = useId();
  // Free text while typing; committed (clamped and rounded to ₹100) on blur.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (text: string) => {
    const rupees = Number(text);
    if (Number.isFinite(rupees) && text.trim() !== '') {
      onChange(clamp(Math.round(rupeesToPaise(rupees) / BUDGET.stepPaise) * BUDGET.stepPaise));
    }
    setDraft(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center font-display text-4xl font-bold text-ink" aria-live="polite">
        {formatRs(valuePaise)}
        <span className="text-lg font-medium text-ink-muted"> / month</span>
      </p>
      <div>
        <label htmlFor={sliderId} className="sr-only">
          Monthly budget slider
        </label>
        <input
          id={sliderId}
          type="range"
          min={BUDGET.minPaise}
          max={BUDGET.maxPaise}
          step={BUDGET.stepPaise}
          value={valuePaise}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={formatRs(valuePaise)}
          className="h-11 w-full accent-brand"
        />
        <div className="flex justify-between text-xs text-ink-muted" aria-hidden>
          <span>{formatRs(BUDGET.minPaise)}</span>
          <span>{formatRs(BUDGET.maxPaise)}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor={inputId} className="text-sm font-medium text-ink">
          Or type an amount (₹)
        </label>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={paiseToRupees(BUDGET.minPaise)}
          max={paiseToRupees(BUDGET.maxPaise)}
          step={paiseToRupees(BUDGET.stepPaise)}
          value={draft ?? String(paiseToRupees(valuePaise))}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget.value)}
          className="min-h-11 w-28 flex-1 rounded-xl border border-line bg-surface px-3 text-base text-ink focus:border-brand focus:outline-none"
        />
      </div>
    </div>
  );
}
