/** Usage levels, cost per use and low-usage tracking (PRD 7.3–7.4). */
import { parseISO } from 'date-fns';
import type { IsoDate, Paise, Subscription, Usage } from '@/types/models';
import { daysUntil, monthlyShareOf, toIsoDate } from './dates';

export type UsageLevel = 'high' | 'normal' | 'low';

/** After this many days of tracking, "I used it" taps replace the star rating. */
export const TAP_TRACKING_DAYS = 14;
export const HIGH_USES = 12;
export const LOW_USES = 2;
/** Ratings 1–5 as estimated uses per month (PRD 7.4). */
export const RATING_USES = [1, 3, 6, 10, 20] as const;

/** "I used it" taps for a subscription in the 30 days ending today (inclusive). */
export function uses30(usages: Usage[], subId: string, today: IsoDate): number {
  return usages.filter((u) => {
    if (u.subId !== subId) return false;
    const ago = -daysUntil(u.date, today);
    return ago >= 0 && ago < 30;
  }).length;
}

/** uses30 for every subscription id, computed in one pass. */
export function uses30ById(usages: Usage[], today: IsoDate): Map<string, number> {
  const counts = new Map<string, number>();
  for (const u of usages) {
    const ago = -daysUntil(u.date, today);
    if (ago >= 0 && ago < 30) counts.set(u.subId, (counts.get(u.subId) ?? 0) + 1);
  }
  return counts;
}

/** Days since the subscription was added to SubSense. */
export function trackedDays(sub: Pick<Subscription, 'createdAt'>, today: IsoDate): number {
  return -daysUntil(toIsoDate(parseISO(sub.createdAt)), today);
}

/** Taps decide once tracked for 14+ days; before that, the 1–5 rating does. */
export function usesTaps(sub: Pick<Subscription, 'createdAt'>, today: IsoDate): boolean {
  return trackedDays(sub, today) >= TAP_TRACKING_DAYS;
}

export function usageLevel(
  sub: Pick<Subscription, 'createdAt' | 'usageRating'>,
  uses: number,
  today: IsoDate,
): UsageLevel {
  if (usesTaps(sub, today)) {
    if (uses >= HIGH_USES) return 'high';
    if (uses <= LOW_USES) return 'low';
    return 'normal';
  }
  if (sub.usageRating >= 5) return 'high';
  if (sub.usageRating <= 2) return 'low';
  return 'normal';
}

/** "Used 18 times in the last 30 days" or, before taps count, "You rated your usage 2 of 5". */
export function usageSummary(
  sub: Pick<Subscription, 'createdAt' | 'usageRating'>,
  uses: number,
  today: IsoDate,
): string {
  if (!usesTaps(sub, today)) return `You rated your usage ${sub.usageRating} of 5`;
  if (uses === 0) return 'Not used in the last 30 days';
  if (uses === 1) return 'Used once in the last 30 days';
  if (uses === 2) return 'Used twice in the last 30 days';
  return `Used ${uses} times in the last 30 days`;
}

/** Monthly share divided by uses (taps), or by the rating's estimated uses. */
export function costPerUsePaise(sub: Subscription, uses: number, today: IsoDate): Paise {
  const monthly = monthlyShareOf(sub);
  const divisor = usesTaps(sub, today)
    ? Math.max(uses, 1)
    : RATING_USES[Math.min(5, Math.max(1, sub.usageRating)) - 1];
  return Math.round(monthly / divisor);
}

/**
 * New lowUsageSince values: set to today when a subscription first becomes low,
 * cleared when it stops being low. Only active subscriptions are tracked.
 * Returns only the subscriptions that change.
 */
export function lowUsageUpdates(
  subs: Subscription[],
  usages: Usage[],
  today: IsoDate,
): Map<string, IsoDate | null> {
  const counts = uses30ById(usages, today);
  const updates = new Map<string, IsoDate | null>();
  for (const s of subs) {
    if (s.status !== 'active') continue;
    const low = usageLevel(s, counts.get(s.id) ?? 0, today) === 'low';
    if (low && !s.lowUsageSince) updates.set(s.id, today);
    if (!low && s.lowUsageSince) updates.set(s.id, null);
  }
  return updates;
}
