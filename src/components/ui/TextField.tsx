import { useId, useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string | null;
  hint?: string;
  /** Adds a show/hide toggle for password inputs. */
  revealable?: boolean;
}

export function TextField({
  label,
  error,
  hint,
  revealable,
  type,
  className,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const inputType = revealable ? (revealed ? 'text' : 'password') : type;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={inputType}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={cn(
            'min-h-11 w-full rounded-xl border bg-surface px-3.5 text-base text-ink placeholder:text-ink-muted/70',
            'focus:border-brand focus:outline-none focus-visible:outline-2',
            error ? 'border-danger' : 'border-line',
            revealable && 'pr-12',
          )}
          {...rest}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-ink-muted hover:text-ink"
          >
            {revealed ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger-ink" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
