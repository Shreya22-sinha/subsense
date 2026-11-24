import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

/** A titled section that opens on tap, so long screens show the essentials first. */
export function Disclosure({
  title,
  hint,
  defaultOpen = false,
  forceOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  /** Keep it open, e.g. because a field inside has an error. */
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const [openState, setOpen] = useState(defaultOpen);
  const open = openState || forceOpen;
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex-1">
          <span className="block text-base font-semibold text-ink">{title}</span>
          {hint && !open && <span className="block text-sm text-ink-muted">{hint}</span>}
        </span>
        <ChevronDown
          size={20}
          aria-hidden
          className={cn('shrink-0 text-ink-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div id={id} className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
