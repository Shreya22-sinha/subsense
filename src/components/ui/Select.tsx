import { useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  /** Visually hide the label (it stays available to screen readers). */
  hideLabel?: boolean;
  error?: string;
  options: Array<{ value: string; label: string }>;
}

/** Native select (best keyboard and mobile behaviour) with app styling. */
export function Select({ label, hideLabel, error, options, className, ...rest }: SelectProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-sm font-medium text-ink', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            'min-h-11 w-full appearance-none rounded-xl border bg-surface pr-10 pl-3.5 text-base text-ink',
            'focus:border-brand focus:outline-none',
            error ? 'border-danger' : 'border-line',
          )}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={18}
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted"
        />
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-danger-ink">
          {error}
        </p>
      )}
    </div>
  );
}
