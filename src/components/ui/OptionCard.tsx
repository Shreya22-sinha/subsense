import { Check, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface OptionCardProps {
  label: string;
  icon: LucideIcon;
  selected: boolean;
  onToggle: () => void;
  /** Checkbox semantics for multi-select, radio for single. */
  multi: boolean;
}

/** Large tappable answer card used by the onboarding quiz. */
export function OptionCard({ label, icon: Icon, selected, onToggle, multi }: OptionCardProps) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={selected}
      onClick={onToggle}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors',
        selected
          ? 'border-brand bg-brand-soft text-ink'
          : 'border-line bg-surface text-ink hover:border-brand/50',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          selected ? 'bg-brand text-white' : 'bg-surface-2 text-brand-ink',
        )}
      >
        <Icon size={20} aria-hidden />
      </span>
      <span className="flex-1">{label}</span>
      {selected && <Check size={18} className="text-brand-ink" aria-hidden />}
    </button>
  );
}
