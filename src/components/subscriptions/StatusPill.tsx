import { cn } from '@/lib/cn';
import { statusKind, type StatusKind } from '@/lib/subscriptionDisplay';
import type { Subscription } from '@/types/models';

const STYLES: Record<StatusKind, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success/15 text-success-ink' },
  trial: { label: 'Free trial', className: 'bg-brand-soft text-brand-ink' },
  paused: { label: 'Paused', className: 'bg-warning/20 text-warning-ink' },
  cancelled: { label: 'Cancelled', className: 'bg-surface-2 text-ink-muted' },
  ended: { label: 'Ended', className: 'bg-surface-2 text-ink-muted' },
};

/** Text label always present, so status is never colour-only. */
export function StatusPill({ sub }: { sub: Pick<Subscription, 'status' | 'isTrial'> }) {
  const { label, className } = STYLES[statusKind(sub)];
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', className)}>
      {label}
    </span>
  );
}
