/**
 * Domain model (PRD section 8).
 * Conventions: ids are crypto.randomUUID() strings, `IsoDate` is YYYY-MM-DD,
 * `IsoTimestamp` is a full ISO string, and all money is integer paise.
 */

export type IsoDate = string;
export type IsoTimestamp = string;
export type Paise = number;

export const CATEGORIES = [
  'Video',
  'Music',
  'Cloud',
  'Productivity',
  'Fitness',
  'Reading',
  'Learning',
  'Gaming',
  'News',
  'Utilities',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'one_time';
export type SubStatus = 'active' | 'paused' | 'cancelled' | 'ended';
export type Liking = 'love' | 'okay' | 'meh';
export type ReminderDays = 1 | 3 | 7;
export type ThemePreference = 'light' | 'dark' | 'system';
export type SharesPlans = 'often' | 'sometimes' | 'never';
export type PricePreference = 'low' | 'quality' | 'balanced';

// ---------- Accounts ----------

export interface User {
  id: string;
  name: string;
  /** Lower-cased, unique. */
  email: string;
  createdAt: IsoTimestamp;
  isDemo: boolean;
}

// ---------- Profile ----------

export interface QuizAnswers {
  q1: string[];
  q2: string;
  q3: string;
  q4: string;
  q5: string;
  q6: string[];
}

export type InterestScores = Record<Category, number>;

export interface Profile {
  onboardingDone: boolean;
  quizAnswers: QuizAnswers;
  interestScores: InterestScores;
  isStudent: boolean;
  sharesPlans: SharesPlans;
  pricePreference: PricePreference;
  savingsFocus: boolean;
  budgetPaise: Paise;
  defaultReminderDays: ReminderDays;
  theme: ThemePreference;
}

// ---------- Subscriptions ----------

export interface Subscription {
  id: string;
  catalogId: string | null;
  name: string;
  planName: string;
  category: Category;
  /** Full price per cycle. */
  pricePaise: Paise;
  cycle: BillingCycle;
  startDate: IsoDate;
  isTrial: boolean;
  trialDays: number | null;
  trialEndDate: IsoDate | null;
  nextChargeDate: IsoDate | null;
  /**
   * The date the billing series is counted from (first charge, trial end, or a date the user
   * set). Charges step from here so month-end dates never drift (31 Jan -> 28 Feb -> 31 Mar).
   * Optional for data saved before it existed.
   */
  chargeAnchor?: IsoDate | null;
  endDate: IsoDate | null;
  autoRenew: boolean;
  sharedWith: number;
  paidWith: string;
  usageRating: number;
  liking: Liking | null;
  reminderDays: ReminderDays;
  notes: string;
  status: SubStatus;
  lowUsageSince: IsoDate | null;
  lastVibeCheckAt: IsoDate | null;
  /**
   * False for subscriptions created from onboarding chips with catalogue defaults;
   * Home prompts the user to confirm the dates (PRD 6.4 step 8).
   */
  datesConfirmed: boolean;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  cancelledAt: IsoDate | null;
}

// ---------- Records ----------

export interface Usage {
  id: string;
  subId: string;
  date: IsoDate;
}

export interface Charge {
  id: string;
  subId: string;
  date: IsoDate;
  /** The user's share. */
  amountPaise: Paise;
  /**
   * How it was recorded. `rollover` = the clock moved past a charge date (these trigger the
   * Confirm item, PRD 7.6); `backfill` = past payments recorded when the subscription was added.
   */
  source?: 'rollover' | 'backfill';
}

export interface PriceChange {
  id: string;
  subId: string;
  date: IsoDate;
  oldPaise: Paise;
  newPaise: Paise;
  /** The billing cycle changed in the same edit, so the two prices aren't comparable (7.5). */
  cycleChanged?: boolean;
  /** "Remind me at renewal" was chosen on the price-hike alert (7.5). */
  remindAtRenewal?: boolean;
}

export type SavingSource =
  'cancel' | 'pause' | 'switch_annual' | 'student' | 'swap' | 'trial_stopped';

export interface Saving {
  id: string;
  subId: string;
  monthlyPaise: Paise;
  startDate: IsoDate;
  source: SavingSource;
}

export interface ActionState {
  itemId: string;
  state: 'done' | 'snoozed';
  until: IsoDate;
}

export interface DismissedPick {
  pickId: string;
  reason: 'already_done' | 'not_relevant' | 'dont_want_to_change';
  until: IsoDate;
}

// ---------- Activity ----------

export const ACTIVITY_GROUPS = {
  Account: [
    'account_created',
    'logged_in',
    'onboarding_completed',
    'budget_changed',
    'quiz_retaken',
  ],
  Added: ['subscription_added'],
  Changed: [
    'subscription_edited',
    'price_changed',
    'subscription_paused',
    'subscription_resumed',
    'subscription_deleted',
  ],
  Billing: ['charged', 'trial_converted', 'subscription_ended', 'budget_exceeded'],
  Decisions: ['decision_made', 'subscription_cancelled', 'vibe_check_answered'],
  Usage: ['usage_logged'],
  Recommendations: ['recommendation_accepted', 'recommendation_dismissed'],
  Data: ['data_exported', 'data_cleared'],
} as const;

export type ActivityGroup = keyof typeof ACTIVITY_GROUPS;
export type ActivityType = (typeof ACTIVITY_GROUPS)[ActivityGroup][number];

export interface Activity {
  id: string;
  type: ActivityType;
  /** Timestamp in demo time. */
  at: IsoTimestamp;
  subId?: string;
  data: Record<string, unknown>;
  /** Ready-made sentence for the timeline. */
  text: string;
}

// ---------- Per-user data blob (subsense_data_<userId>) ----------

export interface UserData {
  profile: Profile;
  subscriptions: Subscription[];
  usages: Usage[];
  charges: Charge[];
  priceChanges: PriceChange[];
  savings: Saving[];
  actionStates: ActionState[];
  dismissedPicks: DismissedPick[];
  activities: Activity[];
}

// ---------- Catalogue (src/data/catalog.json) ----------

/**
 * A plan bills `pricePaise` every `cycle`. `yearlyPaise` is the yearly alternative for a
 * monthly plan (used by the Go annual pick). Deviation from the PRD shape: an explicit
 * per-cycle price is needed because some services bill quarterly.
 */
export interface CatalogPlan {
  name: string;
  cycle: BillingCycle;
  pricePaise: Paise;
  yearlyPaise?: Paise;
  studentPaise?: Paise;
  familyPaise?: Paise;
  trialDays?: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  category: Category;
  plans: CatalogPlan[];
  officialUrl: string;
  cancelUrl: string;
  /** Null until prices are checked by hand against the official page (build step 4). */
  lastVerified: IsoDate | null;
  /** Utility templates: no brand, user enters the price. */
  isTemplate?: boolean;
}
