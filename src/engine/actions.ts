/**
 * Action Center (PRD 7.6): what needs a decision, in 5 urgency levels.
 * Item id = <level>_<subId>_<charge or end date>, so a decision on one date does not hide
 * the item for the next cycle.
 */
import { format, parseISO } from 'date-fns';
import { formatRs } from '@/lib/format';
import type {
  ActionState,
  Charge,
  IsoDate,
  Paise,
  PriceChange,
  Subscription,
  Usage,
} from '@/types/models';
import { addDaysIso, daysUntil, sharePaise } from './dates';
import { chargeWillHappen } from './rollover';
import { usageLevel, uses30ById } from './usage';

export type ActionLevel = 'urgent' | 'review' | 'headsup' | 'ending' | 'confirm';

export const ACTION_LEVELS: ActionLevel[] = ['urgent', 'review', 'headsup', 'ending', 'confirm'];

export const LEVEL_LABELS: Record<ActionLevel, string> = {
  urgent: 'Urgent',
  review: 'Review',
  headsup: 'Heads-up',
  ending: 'Ending',
  confirm: 'Confirm',
};

export interface ActionItem {
  id: string;
  level: ActionLevel;
  subId: string;
  subName: string;
  /** One-line reason, e.g. "Trial converts to ₹649 in 2 days". */
  reason: string;
  /** The charge or end date the item is about. */
  date: IsoDate;
  amountPaise: Paise;
  /** Confirm items: the Charge being confirmed. */
  chargeId?: string;
}

export interface ActionInput {
  subscriptions: Subscription[];
  charges: Charge[];
  usages: Usage[];
  priceChanges: PriceChange[];
  actionStates: ActionState[];
}

const TRIAL_DAYS = 3;
const REVIEW_DAYS = 7;
const HEADSUP_MIN = 8;
const HEADSUP_MAX = 30;
const ENDING_DAYS = 7;
const CONFIRM_DAYS = 3;
const PRICE_REMINDER_DAYS = 3;

export const itemId = (level: ActionLevel, subId: string, date: IsoDate) =>
  `${level}_${subId}_${date}`;

const when = (days: number) => (days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`);
const shortDate = (date: IsoDate) => format(parseISO(date), 'd MMM');

/** An item stays hidden once done, and while snoozed (until a later demo day). */
export function isHidden(id: string, states: ActionState[], today: IsoDate): boolean {
  const s = states.find((x) => x.itemId === id);
  if (!s) return false;
  return s.state === 'done' || daysUntil(s.until, today) > 0;
}

export function computeActionItems(input: ActionInput, today: IsoDate): ActionItem[] {
  const counts = uses30ById(input.usages, today);
  const items: ActionItem[] = [];
  const subsById = new Map(input.subscriptions.map((s) => [s.id, s]));

  for (const s of input.subscriptions) {
    if (s.status !== 'active') continue;
    const amount = sharePaise(s.pricePaise, s.sharedWith);
    // A due date that won't be charged (auto-renew off, past the end date) is not a charge.
    const next =
      s.nextChargeDate && chargeWillHappen(s, s.nextChargeDate) ? s.nextChargeDate : null;
    const nextIn = next ? daysUntil(next, today) : null;

    // Urgent: trial ends in 0–3 days.
    if (s.isTrial && s.trialEndDate && s.autoRenew) {
      const d = daysUntil(s.trialEndDate, today);
      if (d >= 0 && d <= TRIAL_DAYS) {
        items.push({
          id: itemId('urgent', s.id, s.trialEndDate),
          level: 'urgent',
          subId: s.id,
          subName: s.name,
          reason: `Trial converts to ${formatRs(amount)} ${when(d)}`,
          date: s.trialEndDate,
          amountPaise: amount,
        });
      }
    }

    // Review: a charge in 0–7 days for something rarely used or "meh", or a due price-hike reminder.
    if (!s.isTrial && next && nextIn !== null && nextIn >= 0 && nextIn <= REVIEW_DAYS) {
      const low = usageLevel(s, counts.get(s.id) ?? 0, today) === 'low';
      const meh = s.liking === 'meh';
      const hike = input.priceChanges.find(
        (p) =>
          p.subId === s.id &&
          p.remindAtRenewal &&
          p.newPaise > p.oldPaise &&
          daysUntil(p.date, next) <= 0 &&
          nextIn <= PRICE_REMINDER_DAYS,
      );
      if (low || meh || hike) {
        const why = hike
          ? `Price went up to ${formatRs(hike.newPaise)}.`
          : meh
            ? 'You said it’s meh.'
            : 'You rarely use this.';
        items.push({
          id: itemId('review', s.id, next),
          level: 'review',
          subId: s.id,
          subName: s.name,
          reason: `${why} ${formatRs(amount)} is charged ${when(nextIn)}`,
          date: next,
          amountPaise: amount,
        });
      }
    }

    // Heads-up: a yearly charge in 8–30 days.
    if (s.cycle === 'yearly' && !s.isTrial && next && nextIn !== null) {
      if (nextIn >= HEADSUP_MIN && nextIn <= HEADSUP_MAX) {
        items.push({
          id: itemId('headsup', s.id, next),
          level: 'headsup',
          subId: s.id,
          subName: s.name,
          reason: `${formatRs(amount)} yearly charge on ${shortDate(next)}`,
          date: next,
          amountPaise: amount,
        });
      }
    }

    // Ending: end date in 0–7 days.
    if (s.endDate) {
      const d = daysUntil(s.endDate, today);
      if (d >= 0 && d <= ENDING_DAYS) {
        items.push({
          id: itemId('ending', s.id, s.endDate),
          level: 'ending',
          subId: s.id,
          subName: s.name,
          reason: `Your plan ends on ${shortDate(s.endDate)}`,
          date: s.endDate,
          amountPaise: amount,
        });
      }
    }
  }

  // Confirm: a charge recorded by rollover in the last 3 days.
  const earliest = addDaysIso(today, -CONFIRM_DAYS);
  for (const c of input.charges) {
    if (c.source !== 'rollover') continue;
    if (daysUntil(c.date, earliest) < 0 || daysUntil(c.date, today) >= 0) continue;
    const s = subsById.get(c.subId);
    if (!s || s.status === 'cancelled') continue;
    items.push({
      id: itemId('confirm', s.id, c.date),
      level: 'confirm',
      subId: s.id,
      subName: s.name,
      reason: `Were you charged ${formatRs(c.amountPaise)} on ${shortDate(c.date)}?`,
      date: c.date,
      amountPaise: c.amountPaise,
      chargeId: c.id,
    });
  }

  return items
    .filter((i) => !isHidden(i.id, input.actionStates, today))
    .sort(
      (a, b) =>
        ACTION_LEVELS.indexOf(a.level) - ACTION_LEVELS.indexOf(b.level) ||
        a.date.localeCompare(b.date) ||
        a.subName.localeCompare(b.subName),
    );
}

/** The bottom-bar count: Urgent plus Review items. */
export function actionBadgeCount(items: ActionItem[]): number {
  return items.filter((i) => i.level === 'urgent' || i.level === 'review').length;
}
