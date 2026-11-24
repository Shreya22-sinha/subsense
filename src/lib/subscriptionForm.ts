/**
 * Add/Edit subscription form (PRD 6.7): raw form values, validation, and conversion to
 * the engine's SubscriptionInput. Values are kept as strings while typing.
 */
import { subYears } from 'date-fns';
import { daysUntil, toIsoDate } from '@/engine/dates';
import type { SubscriptionInput } from '@/engine/subscriptions';
import { rupeesToPaise } from '@/lib/format';
import type {
  BillingCycle,
  Category,
  IsoDate,
  Liking,
  ReminderDays,
  Subscription,
} from '@/types/models';

export interface SubscriptionFormValues {
  catalogId: string | null;
  name: string;
  planName: string;
  category: Category | '';
  price: string;
  cycle: BillingCycle;
  startDate: IsoDate;
  isTrial: boolean;
  trialDays: string;
  /** Null = use the calculated next charge date. */
  nextChargeOverride: IsoDate | null;
  endDate: IsoDate | '';
  autoRenew: boolean;
  sharedWith: string;
  paidWith: string;
  usageRating: number;
  liking: Liking | null;
  reminderDays: ReminderDays;
  notes: string;
}

export type FormField = keyof SubscriptionFormValues | 'nextCharge';
export type FormErrors = Partial<Record<FormField, string>>;

export const LIMITS = {
  nameMax: 40,
  priceMaxRupees: 100_000,
  trialMin: 1,
  trialMax: 365,
  sharedMin: 1,
  sharedMax: 10,
  paidWithMax: 30,
  notesMax: 200,
  startYearsBack: 10,
} as const;

export function emptyFormValues(
  today: IsoDate,
  reminderDays: ReminderDays,
): SubscriptionFormValues {
  return {
    catalogId: null,
    name: '',
    planName: '',
    category: '',
    price: '',
    cycle: 'monthly',
    startDate: today,
    isTrial: false,
    trialDays: '7',
    nextChargeOverride: null,
    endDate: '',
    autoRenew: true,
    sharedWith: '1',
    paidWith: '',
    usageRating: 3,
    liking: null,
    reminderDays,
    notes: '',
  };
}

export function formValuesFrom(sub: Subscription): SubscriptionFormValues {
  return {
    catalogId: sub.catalogId,
    name: sub.name,
    planName: sub.planName,
    category: sub.category,
    price: String(sub.pricePaise / 100),
    cycle: sub.cycle,
    startDate: sub.startDate,
    isTrial: sub.isTrial,
    trialDays: String(sub.trialDays ?? 7),
    nextChargeOverride: null,
    endDate: sub.endDate ?? '',
    autoRenew: sub.autoRenew,
    sharedWith: String(sub.sharedWith),
    paidWith: sub.paidWith,
    usageRating: sub.usageRating,
    liking: sub.liking,
    reminderDays: sub.reminderDays,
    notes: sub.notes,
  };
}

const isInt = (s: string) => /^\d+$/.test(s.trim());
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
/** 12+ digits, ignoring spaces and dashes: looks like a card or account number. */
const looksLikeCardNumber = (s: string) => /\d{12,}/.test(s.replace(/[\s-]/g, ''));

export function validateSubscriptionForm(v: SubscriptionFormValues, today: IsoDate): FormErrors {
  const e: FormErrors = {};

  const name = v.name.trim();
  if (!name) e.name = 'Enter the service name.';
  else if (name.length > LIMITS.nameMax) e.name = `Use ${LIMITS.nameMax} characters or fewer.`;

  if (!v.category) e.category = 'Choose a category.';

  const price = Number(v.price);
  if (v.price.trim() === '') e.price = 'Enter the price.';
  else if (!Number.isFinite(price) || price < 0) e.price = 'Enter a valid amount.';
  else if (price > LIMITS.priceMaxRupees) e.price = 'Price must be ₹1,00,000 or less.';
  else if (price === 0 && !/free/i.test(v.planName))
    e.price = '₹0 is only for free plans. Name the plan "Free" if this is one.';

  const earliestStart = toIsoDate(subYears(new Date(`${today}T12:00:00`), LIMITS.startYearsBack));
  if (!isDate(v.startDate)) e.startDate = 'Choose a start date.';
  else if (daysUntil(v.startDate, earliestStart) < 0)
    e.startDate = `Start date can't be more than ${LIMITS.startYearsBack} years ago.`;

  if (v.isTrial) {
    const days = Number(v.trialDays);
    if (!isInt(v.trialDays) || days < LIMITS.trialMin || days > LIMITS.trialMax)
      e.trialDays = `Trial length must be ${LIMITS.trialMin} to ${LIMITS.trialMax} days.`;
  }

  if (v.nextChargeOverride !== null && v.cycle !== 'one_time') {
    if (!isDate(v.nextChargeOverride)) e.nextCharge = 'Choose a next charge date.';
    else if (daysUntil(v.nextChargeOverride, today) < 0)
      e.nextCharge = "Next charge date can't be in the past.";
  }

  if (v.endDate) {
    if (!isDate(v.endDate)) e.endDate = 'Choose a valid end date.';
    else if (isDate(v.startDate) && daysUntil(v.endDate, v.startDate) <= 0)
      e.endDate = 'End date must be after the start date.';
  }

  const shared = Number(v.sharedWith);
  if (!isInt(v.sharedWith) || shared < LIMITS.sharedMin || shared > LIMITS.sharedMax)
    e.sharedWith = `Enter ${LIMITS.sharedMin} to ${LIMITS.sharedMax} people.`;

  if (v.paidWith.length > LIMITS.paidWithMax)
    e.paidWith = `Use ${LIMITS.paidWithMax} characters or fewer.`;
  else if (looksLikeCardNumber(v.paidWith))
    e.paidWith = 'Don\'t enter card or account numbers. A label like "HDFC card" is enough.';

  if (v.notes.length > LIMITS.notesMax) e.notes = `Use ${LIMITS.notesMax} characters or fewer.`;

  return e;
}

/** Converts valid form values. Call only when validateSubscriptionForm() returned no errors. */
export function toSubscriptionInput(v: SubscriptionFormValues): SubscriptionInput {
  return {
    catalogId: v.catalogId,
    name: v.name,
    planName: v.planName,
    category: v.category as Category,
    pricePaise: rupeesToPaise(Number(v.price)),
    cycle: v.cycle,
    startDate: v.startDate,
    isTrial: v.isTrial,
    trialDays: v.isTrial ? Number(v.trialDays) : null,
    endDate: v.endDate || null,
    autoRenew: v.autoRenew,
    sharedWith: Number(v.sharedWith),
    paidWith: v.paidWith,
    usageRating: v.usageRating,
    liking: v.liking,
    reminderDays: v.reminderDays,
    notes: v.notes,
  };
}
