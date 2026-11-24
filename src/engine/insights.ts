/**
 * Analytics calculations (PRD 7.9) and the budget-exceeded check (7.2).
 * Months are "YYYY-MM" keys.
 */
import { addDays, addMonths, differenceInMonths, endOfMonth, format, parseISO } from 'date-fns';
import { formatRs } from '@/lib/format';
import {
  ACTIVITY_GROUPS,
  type Activity,
  type ActivityType,
  type Category,
  type Charge,
  type IsoDate,
  type Paise,
  type Saving,
  type Subscription,
  type Usage,
} from '@/types/models';
import { daysUntil, monthlyShareOf, toIsoDate } from './dates';
import { rollover } from './rollover';
import { costPerUsePaise, uses30ById } from './usage';

export type MonthKey = string;

// ---------- Months ----------

export const monthOf = (date: IsoDate): MonthKey => date.slice(0, 7);
export const monthStart = (m: MonthKey): IsoDate => `${m}-01`;
export const monthEnd = (m: MonthKey): IsoDate => toIsoDate(endOfMonth(parseISO(monthStart(m))));
export const shiftMonth = (m: MonthKey, n: number): MonthKey =>
  monthOf(toIsoDate(addMonths(parseISO(monthStart(m)), n)));
export const monthLabel = (m: MonthKey): string => format(parseISO(monthStart(m)), 'MMMM yyyy');
export const monthShort = (m: MonthKey): string => format(parseISO(monthStart(m)), 'MMM');
const monthName = (m: MonthKey): string => format(parseISO(monthStart(m)), 'MMMM');

/** Local calendar date of a timestamp. */
export const dateOfTimestamp = (at: string): IsoDate => toIsoDate(parseISO(at));

// ---------- Spend ----------

/** Sum of Charge records dated in the month. */
export function spentInMonth(charges: Charge[], m: MonthKey): Paise {
  return charges.filter((c) => monthOf(c.date) === m).reduce((sum, c) => sum + c.amountPaise, 0);
}

export interface ScheduledCharge {
  subId: string;
  date: IsoDate;
  amountPaise: Paise;
}

/** Charges still scheduled from today to the end of today's month (the projection). */
export function scheduledRestOfMonth(subs: Subscription[], today: IsoDate): ScheduledCharge[] {
  const end = monthEnd(monthOf(today));
  return subs.flatMap((s) =>
    rollover(s, end, { inclusive: true })
      .charges.filter((c) => daysUntil(c.date, today) >= 0)
      .map((c) => ({ subId: s.id, date: c.date, amountPaise: c.amountPaise })),
  );
}

/** Charges due from today through the next `days` days, soonest first (Home "Coming up"). */
export function upcomingCharges(subs: Subscription[], today: IsoDate, days = 7): ScheduledCharge[] {
  const end = toIsoDate(addDays(parseISO(today), days));
  return subs
    .flatMap((s) =>
      rollover(s, end, { inclusive: true })
        .charges.filter((c) => daysUntil(c.date, today) >= 0)
        .map((c) => ({ subId: s.id, date: c.date, amountPaise: c.amountPaise })),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface MonthSpend {
  month: MonthKey;
  spent: Paise;
  /** Scheduled for the rest of the month (current month only). */
  projected: Paise;
}

export function monthSpend(
  m: MonthKey,
  charges: Charge[],
  subs: Subscription[],
  today: IsoDate,
): MonthSpend {
  const projected =
    m === monthOf(today)
      ? scheduledRestOfMonth(subs, today).reduce((sum, c) => sum + c.amountPaise, 0)
      : 0;
  return { month: m, spent: spentInMonth(charges, m), projected };
}

/** The `count` months ending at `last`, oldest first. */
export function spendTrend(
  last: MonthKey,
  charges: Charge[],
  subs: Subscription[],
  today: IsoDate,
  count = 6,
): MonthSpend[] {
  return Array.from({ length: count }, (_, i) =>
    monthSpend(shiftMonth(last, i - count + 1), charges, subs, today),
  );
}

// ---------- Savings and decisions ----------

/** Monthly amounts of Saving records in effect during the month. */
export function savedInMonth(savings: Saving[], m: MonthKey): Paise {
  const end = monthEnd(m);
  return savings
    .filter((s) => daysUntil(s.startDate, end) <= 0)
    .reduce((sum, s) => sum + s.monthlyPaise, 0);
}

/** For each Saving, monthly amount x full months since its start. */
export function totalSaved(savings: Saving[], today: IsoDate): Paise {
  return savings.reduce(
    (sum, s) =>
      sum +
      s.monthlyPaise * Math.max(0, differenceInMonths(parseISO(today), parseISO(s.startDate))),
    0,
  );
}

export function activitiesInMonth(activities: Activity[], m: MonthKey): Activity[] {
  return activities.filter((a) => monthOf(dateOfTimestamp(a.at)) === m);
}

export function decisionsInMonth(activities: Activity[], m: MonthKey): number {
  return activitiesInMonth(activities, m).filter(
    (a) => a.type === 'decision_made' || a.type === 'recommendation_accepted',
  ).length;
}

// ---------- Categories ----------

/** Was the subscription active on `date`, as far as the stored dates tell? */
export function wasActiveOn(s: Subscription, date: IsoDate): boolean {
  if (daysUntil(s.startDate, date) > 0) return false;
  switch (s.status) {
    case 'active':
      return true;
    case 'paused':
      return false;
    case 'cancelled':
      return !!s.cancelledAt && daysUntil(s.cancelledAt, date) > 0;
    case 'ended':
      return !!s.endDate && daysUntil(s.endDate, date) >= 0;
  }
}

export interface CategorySlice {
  category: Category;
  monthlyPaise: Paise;
  /** Share of the total, 0–1. */
  share: number;
}

/** Monthly equivalent of subscriptions active on `asOf`, grouped by category, largest first. */
export function categoryBreakdown(subs: Subscription[], asOf: IsoDate): CategorySlice[] {
  const totals = new Map<Category, Paise>();
  for (const s of subs) {
    if (!wasActiveOn(s, asOf)) continue;
    const m = monthlyShareOf(s);
    if (m > 0) totals.set(s.category, (totals.get(s.category) ?? 0) + m);
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .map(([category, monthlyPaise]) => ({
      category,
      monthlyPaise,
      share: sum ? monthlyPaise / sum : 0,
    }))
    .sort((a, b) => b.monthlyPaise - a.monthlyPaise);
}

/** "End of the month, or today for the current month." */
export function breakdownDate(m: MonthKey, today: IsoDate): IsoDate {
  return m === monthOf(today) ? today : monthEnd(m);
}

// ---------- Cost per use ----------

export interface CostPerUse {
  sub: Subscription;
  costPaise: Paise;
}

export function costPerUseTop(
  subs: Subscription[],
  usages: Usage[],
  today: IsoDate,
  limit = 5,
): CostPerUse[] {
  const counts = uses30ById(usages, today);
  return subs
    .filter((s) => s.status === 'active' && s.category !== 'Utilities' && monthlyShareOf(s) > 0)
    .map((sub) => ({ sub, costPaise: costPerUsePaise(sub, counts.get(sub.id) ?? 0, today) }))
    .sort((a, b) => b.costPaise - a.costPaise)
    .slice(0, limit);
}

// ---------- Highlights ----------

export interface HighlightInput {
  subscriptions: Subscription[];
  charges: Charge[];
  savings: Saving[];
  usages: Usage[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Up to 3 auto-written lines, the first that apply in PRD order. */
export function highlights(m: MonthKey, data: HighlightInput, today: IsoDate): string[] {
  const lines: string[] = [];
  const startedIn = data.savings.filter((s) => monthOf(s.startDate) === m);

  const cancels = startedIn.filter((s) => s.source === 'cancel' || s.source === 'trial_stopped');
  if (cancels.length) {
    const sum = cancels.reduce((a, s) => a + s.monthlyPaise, 0);
    lines.push(
      `You cancelled ${plural(cancels.length, 'subscription', 'subscriptions')} and saved ${formatRs(sum)}/month.`,
    );
  }

  const trials = startedIn.filter((s) => s.source === 'trial_stopped');
  if (trials.length) {
    const sum = trials.reduce((a, s) => a + s.monthlyPaise, 0);
    lines.push(
      `You stopped ${plural(trials.length, 'trial', 'trials')} before it charged you ${formatRs(sum)}.`,
    );
  }

  const total = (x: MonthSpend) => x.spent + x.projected;
  const current = total(monthSpend(m, data.charges, data.subscriptions, today));
  const previous = total(monthSpend(shiftMonth(m, -1), data.charges, data.subscriptions, today));
  if (previous > 0) {
    const change = Math.round(((current - previous) / previous) * 100);
    if (Math.abs(change) >= 10) {
      lines.push(
        `You spent ${Math.abs(change)}% ${change < 0 ? 'less' : 'more'} than ${monthName(shiftMonth(m, -1))}.`,
      );
    }
  }

  const top = categoryBreakdown(data.subscriptions, breakdownDate(m, today))[0];
  if (top) lines.push(`${top.category} is ${Math.round(top.share * 100)}% of your spend.`);

  const perSub = new Map<string, number>();
  for (const u of data.usages)
    if (monthOf(u.date) === m) perSub.set(u.subId, (perSub.get(u.subId) ?? 0) + 1);
  const [bestId, bestUses] = [...perSub.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  const best = data.subscriptions.find((s) => s.id === bestId);
  if (best && bestUses) {
    lines.push(
      `${best.name} was your most used subscription (${plural(bestUses, 'use', 'uses')}).`,
    );
  }

  return lines.slice(0, 3);
}

// ---------- Timeline ----------

export const TIMELINE_FILTERS = {
  All: null,
  Added: ACTIVITY_GROUPS.Added,
  Changed: ACTIVITY_GROUPS.Changed,
  Decisions: ACTIVITY_GROUPS.Decisions,
  Usage: ACTIVITY_GROUPS.Usage,
  Recommendations: ACTIVITY_GROUPS.Recommendations,
} as const satisfies Record<string, readonly ActivityType[] | null>;

export type TimelineFilter = keyof typeof TIMELINE_FILTERS;

// ---------- Budget exceeded (7.2) ----------

/** True when over budget and budget_exceeded has not been logged this calendar month. */
export function shouldLogBudgetExceeded(
  monthlyTotalPaise: Paise,
  budgetPaise: Paise,
  activities: Activity[],
  today: IsoDate,
): boolean {
  if (budgetPaise <= 0 || monthlyTotalPaise <= budgetPaise) return false;
  const m = monthOf(today);
  return !activities.some(
    (a) => a.type === 'budget_exceeded' && monthOf(dateOfTimestamp(a.at)) === m,
  );
}
