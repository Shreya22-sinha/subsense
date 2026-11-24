/**
 * Demo account (PRD 9.2). Always rebuilt from here with dates relative to `today`, so it
 * never goes stale. Each subscription is chosen to make a specific rule fire on first load:
 *
 * | Subscription            | Shows                                                       |
 * |-------------------------|-------------------------------------------------------------|
 * | Netflix, trial (2 days) | Urgent, Trial ending badge (Decide pick in step 8)          |
 * | ZEE5 + JioHotstar       | Duplicate badge; Hotstar rarely used (Overlap pick)         |
 * | Spotify, ~20 uses       | Most used badge (Go annual pick)                            |
 * | Cult.fit, 1 use, "meh"  | Review item, Least used badge (Trim, could-have-saved)      |
 * | Google One, yearly      | Heads-up item (renews in ~20 days)                          |
 * | Notion 3-month plan     | Ending item (auto-renew off, ends in 6 days)                |
 * | YouTube Premium         | Price went up 10 days ago; Confirm item (charged yesterday) |
 * | Broadband (utility)     | Counted in totals, never in picks                           |
 * | CineLite, Audible       | 2 past cancellations with Saving records                    |
 *
 * Profile: Learning and Reading interests of 40+ with no subscriptions in either (Discover),
 * not a student, budget ₹2,000, monthly total ~₹1,826 (amber, ₹174 headroom: enough for a
 * ₹169 Reading plan so Discover can fire).
 */
import { addMonths, subMonths, subYears } from 'date-fns';
import { addDaysIso, toIsoDate } from '@/engine/dates';
import { scoreQuiz } from '@/engine/quizScoring';
import { createSubscription, type SubscriptionInput } from '@/engine/subscriptions';
import { emptyProfile } from '@/engine/userData';
import { formatDate, formatRs } from '@/lib/format';
import type {
  Activity,
  ActivityType,
  Charge,
  IsoDate,
  PriceChange,
  QuizAnswers,
  Saving,
  Subscription,
  Usage,
  UserData,
} from '@/types/models';

export const DEMO_USER = {
  name: 'Aarav (Demo)',
  email: 'demo@subsense.app',
} as const;

const DEMO_QUIZ: QuizAnswers = {
  q1: ['binge', 'reading', 'learning'],
  q2: 'all_day',
  q3: 'professional',
  q4: 'sometimes',
  q5: 'balanced',
  q6: ['language', 'read_more'],
};

export interface SeedContext {
  today: IsoDate;
  /** Timestamp factory: days offset from today -> ISO timestamp. */
  at: (daysFromToday: number) => string;
  newId: () => string;
}

interface Seed {
  key: string;
  input: SubscriptionInput;
  /** Days ago it was added to SubSense (taps count after 14 days). */
  addedDaysAgo: number;
  /** "I used it" taps in the last 30 days, spread evenly. */
  taps30?: number;
  /** Taps in the 30 days before that (for last month's analytics). */
  tapsPrev?: number;
  /** Cancelled this many days ago. */
  cancelledDaysAgo?: number;
  patch?: Partial<Subscription>;
}

export function buildDemoData({ today, at, newId }: SeedContext): UserData {
  const d = (days: number) => addDaysIso(today, days);
  const noon = (date: IsoDate) => new Date(`${date}T12:00:00`);
  const monthsBefore = (date: IsoDate, n: number) => toIsoDate(subMonths(noon(date), n));
  /**
   * A start date at least 
 months before date whose monthly series lands exactly on
   * date (month-end clamping can otherwise shift it, e.g. from the 31st).
   */
  const monthsBeforeExact = (date: IsoDate, n: number) => {
    for (let k = n; k < n + 12; k++) {
      const start = monthsBefore(date, k);
      if (toIsoDate(addMonths(noon(start), k)) === date) return start;
    }
    return monthsBefore(date, n);
  };
  const daysAgoOf = (date: IsoDate) =>
    Math.round((noon(today).getTime() - noon(date).getTime()) / 86_400_000);

  const seeds: Seed[] = [
    {
      key: 'netflix',
      addedDaysAgo: 5,
      taps30: 3,
      input: {
        catalogId: 'netflix',
        name: 'Netflix',
        planName: 'Mobile',
        category: 'Video',
        pricePaise: 14900,
        cycle: 'monthly',
        startDate: d(-5),
        isTrial: true,
        trialDays: 7,
        usageRating: 4,
      },
    },
    {
      key: 'zee5',
      addedDaysAgo: 58,
      taps30: 8,
      tapsPrev: 6,
      input: {
        catalogId: 'zee5',
        name: 'ZEE5',
        planName: 'Premium HD',
        category: 'Video',
        pricePaise: 39900,
        cycle: 'quarterly',
        startDate: d(-50),
        liking: 'okay',
      },
    },
    {
      key: 'hotstar',
      addedDaysAgo: 58,
      taps30: 1,
      tapsPrev: 2,
      input: {
        catalogId: 'jiohotstar',
        name: 'JioHotstar',
        planName: 'Super',
        category: 'Video',
        pricePaise: 29900,
        cycle: 'quarterly',
        startDate: d(-75),
        usageRating: 2,
      },
    },
    {
      key: 'spotify',
      addedDaysAgo: 58,
      taps30: 20,
      tapsPrev: 18,
      input: {
        catalogId: 'spotify',
        name: 'Spotify',
        planName: 'Premium Individual',
        category: 'Music',
        pricePaise: 13900,
        cycle: 'monthly',
        startDate: monthsBefore(d(9), 7),
        usageRating: 5,
        liking: 'love',
        paidWith: 'UPI',
      },
    },
    {
      key: 'cultfit',
      addedDaysAgo: 58,
      taps30: 1,
      tapsPrev: 1,
      input: {
        catalogId: 'cultfit',
        name: 'Cult.fit',
        planName: 'cultpass HOME',
        category: 'Fitness',
        pricePaise: 39900,
        cycle: 'monthly',
        startDate: monthsBefore(d(5), 4),
        usageRating: 1,
        liking: 'meh',
      },
      patch: { lowUsageSince: d(-70), lastVibeCheckAt: d(-30) },
    },
    {
      key: 'googleone',
      addedDaysAgo: 58,
      input: {
        catalogId: 'google-one',
        name: 'Google One',
        planName: '100 GB Annual',
        category: 'Cloud',
        pricePaise: 130000,
        cycle: 'yearly',
        startDate: toIsoDate(subYears(noon(d(20)), 1)),
        usageRating: 3,
      },
    },
    {
      key: 'notion',
      addedDaysAgo: 58,
      input: {
        catalogId: 'notion',
        name: 'Notion',
        planName: 'Plus (3 months)',
        category: 'Productivity',
        pricePaise: 45000,
        cycle: 'quarterly',
        startDate: monthsBefore(d(6), 3),
        endDate: d(6),
        autoRenew: false,
        usageRating: 3,
      },
    },
    {
      key: 'youtube',
      addedDaysAgo: 58,
      taps30: 10,
      tapsPrev: 9,
      input: {
        catalogId: 'youtube-premium',
        name: 'YouTube Premium',
        planName: 'Individual',
        category: 'Music',
        pricePaise: 14900,
        cycle: 'monthly',
        startDate: monthsBeforeExact(d(-1), 6),
        paidWith: 'HDFC card',
      },
    },
    {
      key: 'broadband',
      addedDaysAgo: 58,
      input: {
        catalogId: 'util-broadband',
        name: 'Broadband',
        planName: '100 Mbps',
        category: 'Utilities',
        pricePaise: 49900,
        cycle: 'monthly',
        startDate: d(-400),
        paidWith: 'Autopay',
      },
    },
    {
      key: 'cinelite',
      addedDaysAgo: 58,
      cancelledDaysAgo: 35,
      tapsPrev: 1,
      input: {
        name: 'CineLite',
        planName: 'Basic',
        category: 'Video',
        pricePaise: 14900,
        cycle: 'monthly',
        startDate: d(-150),
        usageRating: 1,
        liking: 'meh',
      },
      patch: { lowUsageSince: d(-120) },
    },
    {
      key: 'audible',
      addedDaysAgo: 20,
      cancelledDaysAgo: 12,
      input: {
        catalogId: 'audible',
        name: 'Audible',
        planName: 'Premium Plus',
        category: 'Reading',
        pricePaise: 19900,
        cycle: 'monthly',
        startDate: d(-20),
        isTrial: true,
        trialDays: 30,
      },
    },
  ];

  const subscriptions: Subscription[] = [];
  const charges: Charge[] = [];
  const usages: Usage[] = [];
  const savings: Saving[] = [];
  const activities: Activity[] = [];
  const ids = new Map<string, string>();

  const log = (
    type: ActivityType,
    daysAgo: number,
    text: string,
    subId?: string,
    data: Record<string, unknown> = {},
  ) => activities.push({ id: newId(), type, at: at(-daysAgo), subId, data, text });

  for (const seed of seeds) {
    const id = newId();
    ids.set(seed.key, id);
    const cancelledOn = seed.cancelledDaysAgo !== undefined ? d(-seed.cancelledDaysAgo) : undefined;
    // A cancelled subscription's payment history stops at its cancellation date.
    const created = createSubscription(seed.input, {
      id,
      today: cancelledOn ?? today,
      now: at(-seed.addedDaysAgo),
      defaultReminderDays: 3,
    });
    let sub: Subscription = { ...created.sub, ...seed.patch };
    if (cancelledOn) {
      sub = { ...sub, status: 'cancelled', cancelledAt: cancelledOn, nextChargeDate: null };
    }
    subscriptions.push(sub);
    for (const c of created.charges) {
      charges.push({
        id: newId(),
        subId: id,
        date: c.date,
        amountPaise: c.amountPaise,
        source: 'backfill',
      });
    }

    // Taps spread evenly over each 30-day window.
    const spread = (n: number, offset: number) => {
      for (let i = 0; i < n; i++) {
        usages.push({ id: newId(), subId: id, date: d(-(offset + Math.floor((i * 30) / n))) });
      }
    };
    if (seed.taps30) spread(seed.taps30, 0);
    if (seed.tapsPrev) spread(seed.tapsPrev, 30);

    log('subscription_added', seed.addedDaysAgo, `You added ${sub.name}.`, id);
  }

  // YouTube: price went up 10 days ago (earlier charges were at the old price), and
  // yesterday's charge was recorded by rollover so the Confirm item shows.
  const yt = ids.get('youtube')!;
  const priceChanges: PriceChange[] = [
    { id: newId(), subId: yt, date: d(-10), oldPaise: 12900, newPaise: 14900 },
  ];
  for (const c of charges) {
    if (c.subId !== yt) continue;
    if (c.date < d(-10)) c.amountPaise = 12900;
    if (c.date === d(-1)) c.source = 'rollover';
  }
  log('subscription_edited', 10, 'You updated YouTube Premium: price.', yt, {
    fields: ['pricePaise'],
  });
  log('price_changed', 10, 'YouTube Premium went from ₹129 to ₹149.', yt, {
    oldPaise: 12900,
    newPaise: 14900,
  });

  // Two past cancellations with savings.
  const cine = ids.get('cinelite')!;
  const aud = ids.get('audible')!;
  savings.push(
    { id: newId(), subId: cine, monthlyPaise: 14900, startDate: d(-35), source: 'cancel' },
    { id: newId(), subId: aud, monthlyPaise: 19900, startDate: d(-12), source: 'trial_stopped' },
  );
  log('subscription_cancelled', 35, 'You cancelled CineLite and saved ₹149/month.', cine, {
    monthlyPaise: 14900,
  });
  log('subscription_cancelled', 12, 'You cancelled Audible and saved ₹199/month.', aud, {
    monthlyPaise: 19900,
    wasTrial: true,
  });

  // Charges from the last ~2 months as timeline entries.
  for (const c of charges) {
    const ago = daysAgoOf(c.date);
    if (ago > 0 && ago <= 55) {
      const sub = subscriptions.find((s) => s.id === c.subId)!;
      log(
        'charged',
        ago,
        `You were charged ${formatRs(c.amountPaise)} for ${sub.name} on ${formatDate(c.date)}.`,
        c.subId,
        { amountPaise: c.amountPaise, date: c.date },
      );
    }
  }

  // A few recent taps in the timeline (not every tap, to keep it readable).
  usages
    .filter((u) => u.date >= d(-6))
    .slice(0, 8)
    .forEach((u) => {
      const sub = subscriptions.find((s) => s.id === u.subId)!;
      log('usage_logged', daysAgoOf(u.date), `You used ${sub.name}.`, u.subId);
    });

  // Account and decisions.
  log('account_created', 58, 'You created your SubSense account.');
  log('onboarding_completed', 58, 'You finished setting up SubSense.');
  log('budget_changed', 40, 'You changed your monthly budget to ₹2,000.', undefined, {
    from: 150000,
    to: 200000,
  });
  log('vibe_check_answered', 30, 'You said Cult.fit is "meh".', ids.get('cultfit'), {
    answer: 'meh',
  });
  log('decision_made', 25, 'You decided to keep Spotify.', ids.get('spotify'), {
    decision: 'keep',
    source: 'action_center',
  });
  log('decision_made', 18, 'You decided ZEE5 is still worth it.', ids.get('zee5'), {
    decision: 'still_worth_it',
    source: 'action_center',
  });
  log('logged_in', 2, 'You logged in.');

  return {
    profile: {
      ...emptyProfile(),
      ...scoreQuiz(DEMO_QUIZ),
      quizAnswers: DEMO_QUIZ,
      onboardingDone: true,
      budgetPaise: 200000,
    },
    subscriptions,
    usages,
    charges,
    priceChanges,
    savings,
    actionStates: [],
    dismissedPicks: [],
    activities,
  };
}
