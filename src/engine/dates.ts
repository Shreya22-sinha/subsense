/**
 * Date and money rules (PRD 7.1). Pure: callers pass `today` as an ISO date.
 * All date maths in the app goes through this module.
 */
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  parseISO,
} from 'date-fns';
import type { BillingCycle, IsoDate, Paise, Subscription } from '@/types/models';

// ---------- ISO helpers ----------

export function toIsoDate(date: Date): IsoDate {
  return format(date, 'yyyy-MM-dd');
}

export function addDaysIso(date: IsoDate, days: number): IsoDate {
  return toIsoDate(addDays(parseISO(date), days));
}

/** Calendar days from `today` to `date` (negative if `date` is in the past). */
export function daysUntil(date: IsoDate, today: IsoDate): number {
  return differenceInCalendarDays(parseISO(date), parseISO(today));
}

// ---------- Cycles ----------

export const CYCLES_PER_YEAR: Record<Exclude<BillingCycle, 'one_time'>, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};

/** `date` moved forward by `n` whole billing cycles. Months clamp (31 Jan + 1 month = 28/29 Feb). */
export function addCycles(date: IsoDate, cycle: BillingCycle, n: number): IsoDate {
  const d = parseISO(date);
  switch (cycle) {
    case 'weekly':
      return toIsoDate(addWeeks(d, n));
    case 'monthly':
      return toIsoDate(addMonths(d, n));
    case 'quarterly':
      return toIsoDate(addMonths(d, 3 * n));
    case 'yearly':
      return toIsoDate(addYears(d, n));
    case 'one_time':
      return date;
  }
}

// ---------- Money ----------

/** Monthly-equivalent cost of a full price. One-time items count as 0 (listed separately). */
export function monthlyEquivalentPaise(pricePaise: Paise, cycle: BillingCycle): Paise {
  switch (cycle) {
    case 'weekly':
      return Math.round((pricePaise * 52) / 12);
    case 'monthly':
      return pricePaise;
    case 'quarterly':
      return Math.round(pricePaise / 3);
    case 'yearly':
      return Math.round(pricePaise / 12);
    case 'one_time':
      return 0;
  }
}

/** Price per cycle divided between the people sharing it. */
export function sharePaise(pricePaise: Paise, sharedWith: number): Paise {
  return Math.round(pricePaise / Math.max(1, sharedWith));
}

/** The user's monthly-equivalent share; every total, chart and saving uses this. */
export function monthlyShareOf(sub: Pick<Subscription, 'pricePaise' | 'cycle' | 'sharedWith'>) {
  return monthlyEquivalentPaise(sharePaise(sub.pricePaise, sub.sharedWith), sub.cycle);
}

/** Sum of monthly shares across active subscriptions. */
export function monthlyTotalPaise(subs: Subscription[]): Paise {
  return subs.filter((s) => s.status === 'active').reduce((sum, s) => sum + monthlyShareOf(s), 0);
}

// ---------- Trial and next charge ----------

export function trialEndDate(startDate: IsoDate, trialDays: number): IsoDate {
  return addDaysIso(startDate, trialDays);
}

type ScheduleInput = Pick<Subscription, 'startDate' | 'cycle' | 'isTrial' | 'trialEndDate'> &
  Partial<Pick<Subscription, 'chargeAnchor'>>;

/** The first date money is due: the trial end for trials, otherwise the start date. */
export function firstChargeDate(sub: ScheduleInput): IsoDate {
  return sub.isTrial && sub.trialEndDate ? sub.trialEndDate : sub.startDate;
}

/** The date the billing series is counted from: the stored anchor, else the first charge. */
export function seriesAnchor(sub: ScheduleInput): IsoDate {
  return sub.chargeAnchor ?? firstChargeDate(sub);
}

/**
 * Next charge date as of `today`.
 * - One-time: null.
 * - Trial: the trial end date (if it is still ahead); after that, the cycle series from it.
 * - Otherwise: the first date on or after `today` in start, start + 1 cycle, start + 2 cycles...
 *   With `afterToday`, a date equal to today is skipped (today's charge is already paid).
 *   Each step is computed from the anchor (not chained) so month-end clamping never drifts.
 */
export function nextChargeDate(
  sub: ScheduleInput,
  today: IsoDate,
  opts: { afterToday?: boolean } = {},
): IsoDate | null {
  if (sub.cycle === 'one_time') return null;
  const minGap = opts.afterToday ? 1 : 0;
  const anchor = seriesAnchor(sub);
  if (daysUntil(anchor, today) >= minGap) return anchor;

  // Jump close to today, then step to the first date on or after it.
  const approxDaysPerCycle = { weekly: 7, monthly: 30.44, quarterly: 91.31, yearly: 365.25 }[
    sub.cycle
  ];
  let n = Math.max(0, Math.floor(-daysUntil(anchor, today) / approxDaysPerCycle) - 1);
  let candidate = addCycles(anchor, sub.cycle, n);
  while (daysUntil(candidate, today) < minGap) {
    n += 1;
    candidate = addCycles(anchor, sub.cycle, n);
  }
  return candidate;
}

// ---------- Display ----------

export const CYCLE_LABELS: Record<BillingCycle, { name: string; short: string }> = {
  weekly: { name: 'Weekly', short: 'wk' },
  monthly: { name: 'Monthly', short: 'mo' },
  quarterly: { name: 'Quarterly', short: 'qtr' },
  yearly: { name: 'Yearly', short: 'yr' },
  one_time: { name: 'One-time', short: 'once' },
};

/** "today", "tomorrow", "in 3 days", "in 2 weeks", or the date after 30 days. */
export function relativeDayLabel(date: IsoDate, today: IsoDate): string {
  const d = daysUntil(date, today);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  if (d < 0) return `${-d} days ago`;
  if (d < 14) return `in ${d} days`;
  if (d <= 30) return `in ${Math.floor(d / 7)} weeks`;
  return format(parseISO(date), 'd MMM yyyy');
}
