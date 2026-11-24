/** Ready-made timeline sentences for Activity records (PRD 6.10). Brand voice: short, "you". */
import { CYCLE_LABELS, monthlyShareOf } from '@/engine/dates';
import { formatDate, formatRs } from '@/lib/format';
import type { Subscription } from '@/types/models';

export function priceLabel(sub: Pick<Subscription, 'pricePaise' | 'cycle' | 'sharedWith'>): string {
  if (sub.cycle === 'monthly') return `${formatRs(sub.pricePaise)}/month`;
  if (sub.cycle === 'one_time') return `${formatRs(sub.pricePaise)} one-time`;
  return `${formatRs(sub.pricePaise)} ${CYCLE_LABELS[sub.cycle].name.toLowerCase()}, ${formatRs(monthlyShareOf(sub))}/month`;
}

const FIELD_NAMES: Record<string, string> = {
  name: 'name',
  planName: 'plan',
  category: 'category',
  pricePaise: 'price',
  cycle: 'billing cycle',
  startDate: 'start date',
  isTrial: 'free trial',
  trialDays: 'trial length',
  endDate: 'end date',
  autoRenew: 'auto-renew',
  sharedWith: 'sharing',
  paidWith: 'payment label',
  usageRating: 'usage rating',
  liking: 'how much you like it',
  reminderDays: 'reminder',
  notes: 'notes',
  catalogId: 'service',
  nextChargeDate: 'next charge date',
};

export const activityText = {
  added: (s: Subscription) => `You added ${s.name} (${priceLabel(s)}).`,
  edited: (s: Subscription, fields: string[]) =>
    fields.length
      ? `You updated ${s.name}: ${fields.map((f) => FIELD_NAMES[f] ?? f).join(', ')}.`
      : `You confirmed the details of ${s.name}.`,
  priceChanged: (s: Subscription, oldPaise: number, newPaise: number) =>
    `${s.name} went from ${formatRs(oldPaise)} to ${formatRs(newPaise)}.`,
  paused: (s: Subscription) => `You paused ${s.name}.`,
  resumed: (s: Subscription) => `You resumed ${s.name}.`,
  deleted: (s: Subscription) => `You deleted ${s.name}.`,
  cancelled: (s: Subscription, monthlyPaise: number) =>
    monthlyPaise > 0
      ? `You cancelled ${s.name} and saved ${formatRs(monthlyPaise)}/month.`
      : `You cancelled ${s.name}.`,
  kept: (s: Subscription) => `You decided to keep ${s.name}.`,
  charged: (s: Subscription, amount: number, date: string) =>
    `You were charged ${formatRs(amount)} for ${s.name} on ${formatDate(date)}.`,
  trialConverted: (s: Subscription, amount: number) =>
    `Your ${s.name} trial ended and ${formatRs(amount)} was charged.`,
  ended: (s: Subscription) => `${s.name} ended.`,
};
