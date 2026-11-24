/**
 * Creating and editing Subscription objects. Pure: ids, today and timestamps are passed in.
 */
import type {
  CatalogItem,
  IsoDate,
  IsoTimestamp,
  ReminderDays,
  Subscription,
} from '@/types/models';
import { firstChargeDate, nextChargeDate, trialEndDate } from './dates';
import { rollover, type RolloverCharge, type RolloverEvent } from './rollover';

/** Everything a user can set on the Add/Edit form (PRD 6.7). */
export type SubscriptionInput = Pick<
  Subscription,
  'name' | 'category' | 'pricePaise' | 'cycle' | 'startDate'
> &
  Partial<
    Pick<
      Subscription,
      | 'catalogId'
      | 'planName'
      | 'isTrial'
      | 'trialDays'
      | 'endDate'
      | 'autoRenew'
      | 'sharedWith'
      | 'paidWith'
      | 'usageRating'
      | 'liking'
      | 'reminderDays'
      | 'notes'
      | 'datesConfirmed'
    >
  >;

export interface BuildContext {
  id: string;
  today: IsoDate;
  now: IsoTimestamp;
  defaultReminderDays: ReminderDays;
}

/**
 * Fills defaults (PRD 6.7 / 8) and derives the trial end date.
 * `nextChargeDate` is the FIRST charge date (may be in the past); createSubscription()
 * then rolls it forward and records the payments already made.
 */
export function buildSubscription(input: SubscriptionInput, ctx: BuildContext): Subscription {
  const isTrial = input.isTrial ?? false;
  const trialDays = isTrial ? (input.trialDays ?? 7) : null;
  const trialEnd = isTrial && trialDays ? trialEndDate(input.startDate, trialDays) : null;

  const sub: Subscription = {
    id: ctx.id,
    catalogId: input.catalogId ?? null,
    name: input.name.trim(),
    planName: input.planName?.trim() ?? '',
    category: input.category,
    pricePaise: input.pricePaise,
    cycle: input.cycle,
    startDate: input.startDate,
    isTrial,
    trialDays,
    trialEndDate: trialEnd,
    nextChargeDate: null,
    endDate: input.endDate ?? null,
    autoRenew: input.autoRenew ?? true,
    sharedWith: input.sharedWith ?? 1,
    paidWith: input.paidWith?.trim() ?? '',
    usageRating: input.usageRating ?? 3,
    liking: input.liking ?? null,
    reminderDays: input.reminderDays ?? ctx.defaultReminderDays,
    notes: input.notes?.trim() ?? '',
    status: 'active',
    lowUsageSince: null,
    lastVibeCheckAt: null,
    datesConfirmed: input.datesConfirmed ?? true,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    cancelledAt: null,
  };
  sub.chargeAnchor = firstChargeDate(sub);
  sub.nextChargeDate = sub.chargeAnchor;
  return sub;
}

export interface CreateResult {
  sub: Subscription;
  /** Payments already made up to and including today. */
  charges: RolloverCharge[];
  events: RolloverEvent[];
}

/**
 * A new subscription with its payment history.
 * Every charge date from the first one up to and including today is treated as already
 * paid (you pay when you subscribe), so "Spent so far" is right and the next charge is
 * always in the future. `nextChargeOverride` replaces the calculated next charge date.
 */
export function createSubscription(
  input: SubscriptionInput,
  ctx: BuildContext,
  opts: { nextChargeOverride?: IsoDate | null } = {},
): CreateResult {
  const result = rollover(buildSubscription(input, ctx), ctx.today, { inclusive: true });
  if (
    opts.nextChargeOverride &&
    result.sub.status === 'active' &&
    result.sub.cycle !== 'one_time'
  ) {
    // A date the user set becomes the new anchor of the series.
    result.sub = {
      ...result.sub,
      nextChargeDate: opts.nextChargeOverride,
      chargeAnchor: opts.nextChargeOverride,
    };
  }
  return result;
}

/**
 * A subscription from an onboarding chip: the catalogue's first plan, started today
 * (and paid today), with dates flagged for the user to confirm on Home.
 */
export function subscriptionFromCatalog(item: CatalogItem, ctx: BuildContext): CreateResult {
  const plan = item.plans[0];
  return createSubscription(
    {
      catalogId: item.id,
      name: item.name,
      planName: plan?.name ?? '',
      category: item.category,
      pricePaise: plan?.pricePaise ?? 0,
      cycle: plan?.cycle ?? 'monthly',
      startDate: ctx.today,
      datesConfirmed: false,
    },
    ctx,
  );
}

// ---------- Editing ----------

const SCHEDULE_FIELDS = ['startDate', 'cycle', 'isTrial', 'trialDays'] as const;
const EDITABLE_FIELDS = [
  'name',
  'planName',
  'category',
  'pricePaise',
  'cycle',
  'startDate',
  'isTrial',
  'trialDays',
  'endDate',
  'autoRenew',
  'sharedWith',
  'paidWith',
  'usageRating',
  'liking',
  'reminderDays',
  'notes',
  'catalogId',
] as const;

export interface EditResult {
  sub: Subscription;
  changedFields: string[];
  /** Set when the price changed. `sameCycle` decides whether a price-hike alert applies (7.5). */
  priceChange: { oldPaise: number; newPaise: number; sameCycle: boolean } | null;
}

/**
 * Apply form values to an existing subscription. Past charges are never rewritten.
 * If a schedule field changed, the next charge is recalculated (skipping today when a
 * charge was already recorded today); an explicit override always wins.
 */
export function applyEdit(
  old: Subscription,
  input: SubscriptionInput,
  ctx: { today: IsoDate; now: IsoTimestamp; chargedToday: boolean },
  opts: { nextChargeOverride?: IsoDate | null } = {},
): EditResult {
  const isTrial = input.isTrial ?? false;
  // A trial that already converted keeps its trial dates (they anchor the billing series).
  const convertedTrial = !isTrial && !old.isTrial;
  const trialDays = isTrial ? (input.trialDays ?? 7) : convertedTrial ? old.trialDays : null;

  const next: Subscription = {
    ...old,
    catalogId: input.catalogId ?? old.catalogId,
    name: input.name.trim(),
    planName: input.planName?.trim() ?? '',
    category: input.category,
    pricePaise: input.pricePaise,
    cycle: input.cycle,
    startDate: input.startDate,
    isTrial,
    trialDays,
    trialEndDate:
      isTrial && trialDays
        ? trialEndDate(input.startDate, trialDays)
        : convertedTrial
          ? old.trialEndDate
          : null,
    endDate: input.endDate ?? null,
    autoRenew: input.autoRenew ?? old.autoRenew,
    sharedWith: input.sharedWith ?? old.sharedWith,
    paidWith: input.paidWith?.trim() ?? '',
    usageRating: input.usageRating ?? old.usageRating,
    liking: input.liking === undefined ? old.liking : input.liking,
    reminderDays: input.reminderDays ?? old.reminderDays,
    notes: input.notes?.trim() ?? '',
    datesConfirmed: true,
    updatedAt: ctx.now,
  };

  const changedFields: string[] = EDITABLE_FIELDS.filter((f) => old[f] !== next[f]);
  const scheduleChanged = SCHEDULE_FIELDS.some((f) => old[f] !== next[f]);

  if (next.status === 'active' || next.status === 'paused') {
    if (opts.nextChargeOverride) {
      // A date the user set becomes the new anchor of the series.
      next.nextChargeDate = next.cycle === 'one_time' ? null : opts.nextChargeOverride;
      next.chargeAnchor = next.nextChargeDate;
    } else if (scheduleChanged) {
      next.chargeAnchor = firstChargeDate(next);
      next.nextChargeDate = nextChargeDate(next, ctx.today, { afterToday: ctx.chargedToday });
    }
  }
  if (old.nextChargeDate !== next.nextChargeDate) changedFields.push('nextChargeDate');

  return {
    sub: next,
    changedFields,
    priceChange:
      old.pricePaise !== next.pricePaise
        ? {
            oldPaise: old.pricePaise,
            newPaise: next.pricePaise,
            sameCycle: old.cycle === next.cycle,
          }
        : null,
  };
}
