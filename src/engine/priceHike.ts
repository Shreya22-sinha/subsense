/** Price-hike alert maths (PRD 7.5). */
import type { BillingCycle, IsoDate, Paise, PriceChange } from '@/types/models';
import { CYCLES_PER_YEAR, daysUntil } from './dates';

export const PRICE_UP_BADGE_DAYS = 30;

export interface PriceHike {
  oldPaise: Paise;
  newPaise: Paise;
  /** Rounded percentage increase, e.g. 34. */
  increasePct: number;
  /** (new - old) x cycles per year. */
  extraPerYearPaise: Paise;
}

/** Null when there is no alert: the price did not go up, or the cycle changed. */
export function priceHike(
  oldPaise: Paise,
  newPaise: Paise,
  oldCycle: BillingCycle,
  newCycle: BillingCycle,
): PriceHike | null {
  if (newPaise <= oldPaise || oldCycle !== newCycle) return null;
  const perYear = newCycle === 'one_time' ? 1 : CYCLES_PER_YEAR[newCycle];
  return {
    oldPaise,
    newPaise,
    increasePct: oldPaise > 0 ? Math.round(((newPaise - oldPaise) / oldPaise) * 100) : 100,
    extraPerYearPaise: (newPaise - oldPaise) * perYear,
  };
}

/** The latest same-cycle increase for a subscription within the last 30 days, if any. */
export function recentIncrease(
  priceChanges: PriceChange[],
  subId: string,
  today: IsoDate,
): PriceChange | undefined {
  return priceChanges
    .filter(
      (p) =>
        p.subId === subId &&
        !p.cycleChanged &&
        p.newPaise > p.oldPaise &&
        -daysUntil(p.date, today) >= 0 &&
        -daysUntil(p.date, today) < PRICE_UP_BADGE_DAYS,
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}
