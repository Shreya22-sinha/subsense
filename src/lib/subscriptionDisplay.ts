/** Display helpers for subscriptions (text only, no rules). */
import { CYCLE_LABELS, relativeDayLabel } from '@/engine/dates';
import { formatRs } from '@/lib/format';
import type { IsoDate, Subscription } from '@/types/models';

export type StatusKind = 'active' | 'trial' | 'paused' | 'cancelled' | 'ended';

export function statusKind(sub: Pick<Subscription, 'status' | 'isTrial'>): StatusKind {
  return sub.status === 'active' && sub.isTrial ? 'trial' : sub.status;
}

/** "Next charge in 3 days", "Trial ends tomorrow", "Paused"… */
export function chargeLine(sub: Subscription, today: IsoDate): string {
  switch (sub.status) {
    case 'paused':
      return 'Paused';
    case 'cancelled':
      return 'Cancelled';
    case 'ended':
      return 'Ended';
    case 'active':
      if (sub.cycle === 'one_time') return 'One-time purchase';
      if (!sub.nextChargeDate) return 'No upcoming charge';
      return `${sub.isTrial ? 'Trial ends' : 'Next charge'} ${relativeDayLabel(sub.nextChargeDate, today)}`;
  }
}

/** "₹649 every month", "₹1,499 every year", "₹500 one-time". */
export function priceAndCycle(sub: Pick<Subscription, 'pricePaise' | 'cycle'>): string {
  if (sub.cycle === 'one_time') return `${formatRs(sub.pricePaise)} one-time`;
  const every = { weekly: 'week', monthly: 'month', quarterly: '3 months', yearly: 'year' }[
    sub.cycle
  ];
  return `${formatRs(sub.pricePaise)} every ${every}`;
}

export const CYCLE_OPTIONS = (Object.keys(CYCLE_LABELS) as Array<keyof typeof CYCLE_LABELS>).map(
  (value) => ({ value, label: CYCLE_LABELS[value].name }),
);
