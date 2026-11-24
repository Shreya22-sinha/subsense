/**
 * Rollover (PRD 7.1): bring a subscription's billing up to `today`.
 * Pure: returns the updated subscription plus the charges and events to record;
 * the store turns them into Charge and Activity records.
 */
import type { IsoDate, Paise, Subscription } from '@/types/models';
import { daysUntil, nextChargeDate, seriesAnchor, sharePaise } from './dates';

export interface RolloverCharge {
  date: IsoDate;
  /** The user's share. */
  amountPaise: Paise;
}

export type RolloverEvent =
  | { type: 'charged'; date: IsoDate; amountPaise: Paise }
  | { type: 'trial_converted'; date: IsoDate; amountPaise: Paise }
  | { type: 'subscription_ended'; date: IsoDate };

export interface RolloverResult {
  sub: Subscription;
  charges: RolloverCharge[];
  events: RolloverEvent[];
}

/**
 * Will the charge due on `date` actually be taken? Not when auto-renew is off or the date is
 * on/after the end date (the plan just ends) - except the first purchase of a non-trial plan.
 * Same rule as rollover() below; used so badges and actions don't warn about phantom charges.
 */
export function chargeWillHappen(
  sub: Pick<Subscription, 'isTrial' | 'startDate' | 'autoRenew' | 'endDate'>,
  date: IsoDate,
): boolean {
  if (!sub.isTrial && date === sub.startDate) return true;
  return sub.autoRenew && !(sub.endDate !== null && daysUntil(sub.endDate, date) <= 0);
}

const MAX_STEPS = 2000; // ~38 years of weekly charges; a guard, never hit in practice

/**
 * For an active subscription whose next charge date is before today
 * (or on today, with `inclusive`):
 * - Auto-renew on: record a charge (a trial converts), move forward one cycle, repeat.
 * - Auto-renew off, or the charge would fall on/after the end date: status becomes `ended`.
 *   The very first purchase of a non-trial plan is always charged, even with auto-renew off.
 * Finally, an active subscription whose end date has passed is ended.
 * Paused, cancelled and ended subscriptions are left alone.
 */
export function rollover(
  sub: Subscription,
  today: IsoDate,
  opts: { inclusive?: boolean } = {},
): RolloverResult {
  if (sub.status !== 'active') return { sub, charges: [], events: [] };

  const isDue = (date: IsoDate) => {
    const d = daysUntil(date, today);
    return opts.inclusive ? d <= 0 : d < 0;
  };

  // Data saved before chargeAnchor existed: the pending charge date is a valid series point.
  let s: Subscription = { ...sub, chargeAnchor: sub.chargeAnchor ?? sub.nextChargeDate };
  const charges: RolloverCharge[] = [];
  const events: RolloverEvent[] = [];

  for (let step = 0; step < MAX_STEPS && s.nextChargeDate && isDue(s.nextChargeDate); step++) {
    const date: IsoDate = s.nextChargeDate;

    if (!chargeWillHappen(s, date)) {
      // Record when it ended, so history (e.g. the Analytics donut) knows it was active before.
      s = { ...s, status: 'ended', nextChargeDate: null, endDate: s.endDate ?? date };
      events.push({ type: 'subscription_ended', date });
      break;
    }

    const amountPaise = sharePaise(s.pricePaise, s.sharedWith);
    charges.push({ date, amountPaise });
    if (s.isTrial) {
      events.push({ type: 'trial_converted', date, amountPaise });
      // Keep counting from the trial end after the trial flag is cleared.
      s = { ...s, isTrial: false, chargeAnchor: seriesAnchor(s) };
    } else {
      events.push({ type: 'charged', date, amountPaise });
    }
    // Step from the series anchor (not the last charge) so month ends never drift.
    s = {
      ...s,
      nextChargeDate: s.cycle === 'one_time' ? null : nextChargeDate(s, date, { afterToday: true }),
    };
  }

  const endDate = s.endDate;
  if (s.status === 'active' && endDate && daysUntil(endDate, today) < 0) {
    s = { ...s, status: 'ended', nextChargeDate: null };
    events.push({ type: 'subscription_ended', date: endDate });
  }

  return { sub: s, charges, events };
}
