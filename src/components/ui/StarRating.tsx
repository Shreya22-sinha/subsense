import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';

const LABELS = ['Barely', 'Rarely', 'Sometimes', 'Often', 'All the time'];

/** 1–5 stars as a radio group. */
export function StarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-ink" aria-hidden>
        {label}
      </span>
      <div className="flex items-center gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of 5: ${LABELS[n - 1]}`}
            onClick={() => onChange(n)}
            className="flex size-11 items-center justify-center rounded-lg hover:bg-surface-2"
          >
            <Star
              size={26}
              aria-hidden
              className={cn(n <= value ? 'fill-warning text-warning' : 'text-line')}
            />
          </button>
        ))}
        <span className="ml-2 text-sm text-ink-muted">{LABELS[value - 1]}</span>
      </div>
    </div>
  );
}
