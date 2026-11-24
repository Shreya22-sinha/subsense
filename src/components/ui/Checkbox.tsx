import { useId, type ReactNode } from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  error?: string | null;
}

export function Checkbox({ checked, onChange, label, error }: CheckboxProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex min-h-11 items-center gap-3 text-sm text-ink">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="size-5 shrink-0 rounded accent-brand"
        />
        <span>{label}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger-ink" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
