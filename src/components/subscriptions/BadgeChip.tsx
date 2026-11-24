import { useEffect, useId, useRef, useState } from 'react';
import {
  CalendarClock,
  Copy,
  Flame,
  Gem,
  Hourglass,
  IndianRupee,
  Moon,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { Badge, BadgeKind } from '@/engine/badges';
import { cn } from '@/lib/cn';

const STYLE: Record<BadgeKind, { icon: LucideIcon; className: string }> = {
  trial_ending: { icon: Hourglass, className: 'bg-danger/12 text-danger-ink' },
  price_up: { icon: TrendingUp, className: 'bg-danger/12 text-danger-ink' },
  renews_soon: { icon: CalendarClock, className: 'bg-warning/20 text-warning-ink' },
  least_used: { icon: Moon, className: 'bg-surface-2 text-ink-muted' },
  duplicate: { icon: Copy, className: 'bg-surface-2 text-ink-muted' },
  most_used: { icon: Flame, className: 'bg-success/15 text-success-ink' },
  priciest: { icon: IndianRupee, className: 'bg-brand-soft text-brand-ink' },
  best_value: { icon: Gem, className: 'bg-success/15 text-success-ink' },
};

/** Icon + text badge (never colour-only). Tapping shows the "why" (PRD 7.3). */
export function BadgeChip({ badge }: { badge: Badge }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const { icon: Icon, className } = STYLE[badge.kind];

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (
        e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          // Visually compact; the padding keeps a 44px-tall hit area via ::before.
          'relative inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold',
          'before:absolute before:-inset-y-2 before:inset-x-0 before:content-[""]',
          className,
        )}
      >
        <Icon size={13} aria-hidden />
        {badge.label}
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className="absolute top-full left-0 z-40 mt-2 w-max max-w-56 rounded-xl bg-ink px-3 py-2 text-xs font-medium text-canvas shadow-lg"
        >
          {badge.why}
        </span>
      )}
    </span>
  );
}
