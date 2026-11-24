/**
 * Badges (PRD 7.3). Each subscription gets its badges in priority order; cards show
 * the first 2. Only active subscriptions get badges.
 */
import { format, parseISO } from 'date-fns';
import { formatRs } from '@/lib/format';
import type { IsoDate, PriceChange, Subscription, Usage } from '@/types/models';
import { daysUntil, monthlyShareOf, sharePaise } from './dates';
import { recentIncrease } from './priceHike';
import { chargeWillHappen } from './rollover';
import { costPerUsePaise, usageLevel, usageSummary, uses30ById } from './usage';

export type BadgeKind =
  | 'trial_ending'
  | 'price_up'
  | 'renews_soon'
  | 'least_used'
  | 'duplicate'
  | 'most_used'
  | 'priciest'
  | 'best_value';

export interface Badge {
  kind: BadgeKind;
  label: string;
  /** Tooltip text naming the data behind the badge. */
  why: string;
}

export const MAX_CARD_BADGES = 2;
const MIN_FOR_RANKING = 3;

const inDays = (days: number) =>
  days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;

interface BadgeContext {
  usages: Usage[];
  priceChanges: PriceChange[];
  today: IsoDate;
}

/**
 * Badges for every active subscription, in priority order.
 * Utilities never get Least used or Duplicate (PRD); they are also left out of
 * Priciest and Best value, which compare discretionary subscriptions.
 */
export function computeBadges(subs: Subscription[], ctx: BadgeContext): Map<string, Badge[]> {
  const { today } = ctx;
  const active = subs.filter((s) => s.status === 'active');
  const counts = uses30ById(ctx.usages, today);
  const uses = (s: Subscription) => counts.get(s.id) ?? 0;

  // Ranking badges across subscriptions.
  const ranked = active.filter((s) => s.category !== 'Utilities' && s.cycle !== 'one_time');
  const priciest =
    active.length >= MIN_FOR_RANKING && ranked.length > 0
      ? ranked.reduce((a, b) => (monthlyShareOf(b) > monthlyShareOf(a) ? b : a))
      : undefined;
  const valued = ranked.filter((s) => monthlyShareOf(s) > 0);
  const bestValue =
    valued.length >= MIN_FOR_RANKING
      ? valued.reduce((a, b) =>
          costPerUsePaise(b, uses(b), today) < costPerUsePaise(a, uses(a), today) ? b : a,
        )
      : undefined;
  const perCategory = new Map<string, number>();
  for (const s of active) perCategory.set(s.category, (perCategory.get(s.category) ?? 0) + 1);

  const result = new Map<string, Badge[]>();
  for (const s of active) {
    const badges: Badge[] = [];
    const isUtility = s.category === 'Utilities';
    // Only charges that will really happen count (not a plan that simply ends).
    const nextIn =
      s.nextChargeDate && chargeWillHappen(s, s.nextChargeDate)
        ? daysUntil(s.nextChargeDate, today)
        : null;
    const trialIn = s.isTrial && s.trialEndDate ? daysUntil(s.trialEndDate, today) : null;
    const trialEnding = trialIn !== null && trialIn >= 0 && trialIn <= 3 && s.autoRenew;
    const level = usageLevel(s, uses(s), today);

    if (trialEnding) {
      badges.push({
        kind: 'trial_ending',
        label: 'Trial ending',
        why: `Your free trial ends ${inDays(trialIn)}`,
      });
    }
    const hike = recentIncrease(ctx.priceChanges, s.id, today);
    if (hike) {
      badges.push({
        kind: 'price_up',
        label: 'Price went up',
        why: `Price went up ${formatRs(hike.newPaise - hike.oldPaise)} on ${format(parseISO(hike.date), 'd MMM')}`,
      });
    }
    if (!trialEnding && nextIn !== null && nextIn >= 0 && nextIn <= 7) {
      badges.push({
        kind: 'renews_soon',
        label: 'Renews soon',
        why: `${formatRs(sharePaise(s.pricePaise, s.sharedWith))} will be charged ${inDays(nextIn)}`,
      });
    }
    if (!isUtility && level === 'low') {
      badges.push({
        kind: 'least_used',
        label: 'Least used',
        why: usageSummary(s, uses(s), today),
      });
    }
    const sameCategory = perCategory.get(s.category) ?? 0;
    if (!isUtility && sameCategory >= 2) {
      badges.push({
        kind: 'duplicate',
        label: 'Duplicate',
        why: `You have ${sameCategory} ${s.category} subscriptions`,
      });
    }
    if (level === 'high') {
      badges.push({ kind: 'most_used', label: 'Most used', why: usageSummary(s, uses(s), today) });
    }
    if (priciest?.id === s.id) {
      badges.push({ kind: 'priciest', label: 'Priciest', why: 'Your most expensive subscription' });
    }
    if (bestValue?.id === s.id) {
      badges.push({
        kind: 'best_value',
        label: 'Best value',
        why: `${formatRs(costPerUsePaise(s, uses(s), today))} per use, your best value`,
      });
    }
    result.set(s.id, badges);
  }
  return result;
}
