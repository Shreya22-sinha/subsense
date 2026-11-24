import { describe, expect, it } from 'vitest';
import type { CatalogItem, Profile, Subscription, Usage } from '@/types/models';
import { emptyQuizAnswers, scoreQuiz } from './quizScoring';
import { computePicks, potentialSavings, type PickInput } from './recommendations';
import { makeSub, taps, TODAY } from './testing';
import { emptyProfile } from './userData';
import { couldHaveSaved, homeVibeCheck, isVibeCheckDue, vibeFollowUp } from './vibeCheck';

const CATALOG: CatalogItem[] = [
  {
    id: 'spotify',
    name: 'Spotify',
    category: 'Music',
    plans: [
      {
        name: 'Premium',
        cycle: 'monthly',
        pricePaise: 13900,
        yearlyPaise: 118900,
        studentPaise: 6900,
      },
    ],
    officialUrl: '',
    cancelUrl: '',
    lastVerified: null,
  },
  {
    id: 'netflix',
    name: 'Netflix',
    category: 'Video',
    plans: [
      { name: 'Mobile', cycle: 'monthly', pricePaise: 14900 },
      { name: 'Premium', cycle: 'monthly', pricePaise: 64900 },
    ],
    officialUrl: '',
    cancelUrl: '',
    lastVerified: null,
  },
  {
    id: 'zee5',
    name: 'ZEE5',
    category: 'Video',
    plans: [{ name: 'HD', cycle: 'quarterly', pricePaise: 39900 }],
    officialUrl: '',
    cancelUrl: '',
    lastVerified: null,
  },
  {
    id: 'kindle',
    name: 'Kindle Unlimited',
    category: 'Reading',
    plans: [{ name: 'Monthly', cycle: 'monthly', pricePaise: 16900 }],
    officialUrl: '',
    cancelUrl: '',
    lastVerified: null,
  },
  {
    id: 'audible',
    name: 'Audible',
    category: 'Reading',
    plans: [{ name: 'Plus', cycle: 'monthly', pricePaise: 19900, studentPaise: 9900 }],
    officialUrl: '',
    cancelUrl: '',
    lastVerified: null,
  },
  {
    id: 'duolingo',
    name: 'Duolingo',
    category: 'Learning',
    plans: [{ name: 'Super', cycle: 'monthly', pricePaise: 52900 }],
    officialUrl: '',
    cancelUrl: '',
    lastVerified: null,
  },
];

function profile(patch: Partial<Profile> = {}): Profile {
  return { ...emptyProfile(), budgetPaise: 200000, ...patch };
}

function picks(
  subs: Subscription[],
  opts: { usages?: Usage[]; profile?: Profile; dismissed?: PickInput['dismissedPicks'] } = {},
) {
  return computePicks(
    {
      profile: opts.profile ?? profile(),
      subscriptions: subs,
      usages: opts.usages ?? [],
      dismissedPicks: opts.dismissed ?? [],
    },
    CATALOG,
    TODAY,
  );
}

describe('savings picks', () => {
  it('Decide: a trial ending in 0–3 days, always first', () => {
    const trial = makeSub({
      id: 't',
      name: 'Netflix',
      catalogId: 'netflix',
      pricePaise: 14900,
      isTrial: true,
      trialEndDate: '2026-11-24',
      nextChargeDate: '2026-11-24',
    });
    const meh = makeSub({ id: 'm', category: 'Fitness', pricePaise: 99900, liking: 'meh' });
    const r = picks([meh, trial]);
    expect(r.ranked.map((p) => p.id)).toEqual(['decide_t', 'trim_m']);
    expect(r.ranked[0].why).toBe(
      "Your free trial ends in 2 days. After that it's ₹149/month unless you cancel.",
    );
  });

  it('Overlap: the least used of 2+ in a category (ties: the pricier)', () => {
    const a = makeSub({ id: 'a', category: 'Video', pricePaise: 49900 });
    const b = makeSub({ id: 'b', category: 'Video', pricePaise: 29900 });
    const r = picks([a, b], { usages: [...taps('a', 5), ...taps('b', 5)] });
    expect(r.ranked.find((p) => p.type === 'overlap')).toMatchObject({
      id: 'overlap_a',
      monthlySavingPaise: 49900,
    });
    const r2 = picks([a, b], { usages: [...taps('a', 9), ...taps('b', 4)] });
    expect(r2.ranked.find((p) => p.type === 'overlap')?.subId).toBe('b');
  });

  it('Trim: low usage or "meh"; never utilities', () => {
    const low = makeSub({ id: 'l', category: 'Fitness' });
    const util = makeSub({ id: 'u', category: 'Utilities' });
    const r = picks([low, util]);
    expect(r.ranked.map((p) => p.id)).toEqual(['trim_l']);
    expect(r.ranked[0].why).toBe('Not used in the last 30 days, and it costs ₹299/month.');
  });

  it('Student: only for students with a cheaper student price', () => {
    const s = makeSub({
      id: 's',
      catalogId: 'spotify',
      name: 'Spotify',
      category: 'Music',
      planName: 'Premium',
      pricePaise: 13900,
    });
    const usages = taps('s', 6);
    expect(picks([s], { usages }).ranked.map((p) => p.type)).not.toContain('student');
    const r = picks([s], { usages, profile: profile({ isStudent: true }) });
    expect(r.ranked[0]).toMatchObject({
      type: 'student',
      monthlySavingPaise: 7000,
      newPricePaise: 6900,
    });
  });

  it('Go annual: monthly, used a lot, cheaper yearly in the catalogue', () => {
    const s = makeSub({
      id: 'g',
      catalogId: 'spotify',
      name: 'Spotify',
      category: 'Music',
      planName: 'Premium',
      pricePaise: 13900,
    });
    const r = picks([s], { usages: taps('g', 18) });
    expect(r.ranked[0]).toMatchObject({
      type: 'go_annual',
      monthlySavingPaise: Math.round((166800 - 118900) / 12),
      newCycle: 'yearly',
    });
    expect(r.ranked[0].why).toBe(
      'You used it 18 times in the last 30 days. Yearly works out to ₹99/month instead of ₹139.',
    );
  });

  it('Swap: a plan in the same category costing 70% or less', () => {
    const s = makeSub({
      id: 'w',
      catalogId: 'zee5',
      name: 'ZEE5',
      category: 'Video',
      pricePaise: 64900,
    });
    const r = picks([s], { usages: taps('w', 6) });
    expect(r.ranked[0]).toMatchObject({
      type: 'swap',
      catalogId: 'netflix',
      planName: 'Mobile',
      monthlySavingPaise: 50000,
    });
    const loved = { ...s, liking: 'love' as const };
    expect(
      picks([loved], { usages: taps('w', 6) }).ranked.filter((p) => p.type !== 'discover'),
    ).toEqual([]);
  });

  it('suggests nothing for a plan that is already ending', () => {
    const ending = makeSub({
      category: 'Productivity',
      autoRenew: false,
      endDate: '2026-11-28',
      nextChargeDate: '2026-11-28',
    });
    expect(picks([ending]).ranked).toEqual([]);
  });

  it('gives each subscription at most one savings pick', () => {
    const s = makeSub({
      id: 'x',
      catalogId: 'spotify',
      category: 'Music',
      planName: 'Premium',
      pricePaise: 13900,
      liking: 'meh',
    });
    const r = picks([s], { profile: profile({ isStudent: true }) });
    expect(r.ranked.filter((p) => p.subId === 'x').map((p) => p.type)).toEqual(['trim']);
  });

  it('ranks savings by saving x confidence and sums potential savings', () => {
    const big = makeSub({ id: 'big', category: 'Fitness', pricePaise: 99900 });
    const small = makeSub({ id: 'small', category: 'Gaming', pricePaise: 19900 });
    const r = picks([small, big]);
    expect(r.ranked.map((p) => p.subId)).toEqual(['big', 'small']);
    expect(potentialSavings(r.ranked)).toBe(119800);
  });

  it('hides dismissed picks for 30 days', () => {
    const s = makeSub({ id: 'd', category: 'Fitness' });
    const dismissed = [{ pickId: 'trim_d', reason: 'not_relevant' as const, until: '2026-12-22' }];
    expect(picks([s], { dismissed }).ranked).toEqual([]);
    const expired = [{ ...dismissed[0], until: TODAY }];
    expect(picks([s], { dismissed: expired }).ranked).toHaveLength(1);
  });
});

describe('Discover', () => {
  const readingLearner = profile({
    ...scoreQuiz({
      ...emptyQuizAnswers(),
      q1: ['reading', 'learning'],
      q6: ['read_more', 'language'],
    }),
    quizAnswers: {
      ...emptyQuizAnswers(),
      q1: ['reading', 'learning'],
      q6: ['read_more', 'language'],
    },
  });

  it('suggests the cheapest fitting plan in interest categories with no subscription', () => {
    const r = picks([], { profile: readingLearner });
    expect(r.ranked.map((p) => p.id)).toEqual(['discover_kindle', 'discover_duolingo']);
    expect(r.ranked[0].why).toBe(
      "You said you want to read more, and you have ₹2,000 of budget room. It's ₹169/month.",
    );
    expect(r.ranked[0].monthlySavingPaise).toBe(-16900);
  });

  it('changes when quiz answers change', () => {
    const gamer = profile(scoreQuiz({ ...emptyQuizAnswers(), q1: ['gaming'] }));
    expect(picks([], { profile: gamer }).ranked).toEqual([]); // no Gaming items in this catalogue
    expect(picks([], { profile: readingLearner }).ranked).toHaveLength(2);
  });

  it('respects headroom and goes away when over budget', () => {
    const tight = { ...readingLearner, budgetPaise: 50000 };
    const spend = makeSub({ category: 'Utilities', pricePaise: 40000 });
    expect(picks([spend], { profile: tight }).ranked.map((p) => p.id)).toEqual([]); // ₹100 left
    const over = makeSub({ category: 'Utilities', pricePaise: 60000 });
    const r = picks([over], { profile: tight });
    expect(r.overBudget).toBe(true);
    expect(r.ranked.filter((p) => p.type === 'discover')).toEqual([]);
  });

  it('prefers student prices for students and caps Discover at 1 with savingsFocus', () => {
    const student = { ...readingLearner, isStudent: true };
    expect(picks([], { profile: student }).ranked[0]).toMatchObject({
      id: 'discover_audible',
      newPricePaise: 9900,
    });
    const focused = { ...readingLearner, savingsFocus: true };
    expect(picks([], { profile: focused }).ranked).toHaveLength(1);
  });

  it('skips categories that already have an active subscription', () => {
    const kindle = makeSub({ category: 'Reading', catalogId: 'kindle', usageRating: 4 });
    const r = picks([kindle], { profile: readingLearner, usages: taps(kindle.id, 6) });
    expect(r.ranked.filter((p) => p.type === 'discover').map((p) => p.id)).toEqual([
      'discover_duolingo',
    ]);
  });
});

describe('vibe check', () => {
  it('is due after 30 days active or with a charge within 7 days, at most every 30 days', () => {
    expect(isVibeCheckDue(makeSub({ startDate: '2026-10-01' }), TODAY)).toBe(true);
    expect(
      isVibeCheckDue(makeSub({ startDate: '2026-11-10', nextChargeDate: '2026-12-10' }), TODAY),
    ).toBe(false);
    expect(
      isVibeCheckDue(makeSub({ startDate: '2026-11-10', nextChargeDate: '2026-11-26' }), TODAY),
    ).toBe(true);
    expect(
      isVibeCheckDue(makeSub({ startDate: '2026-10-01', lastVibeCheckAt: '2026-11-01' }), TODAY),
    ).toBe(false);
    expect(isVibeCheckDue(makeSub({ startDate: '2026-10-01', category: 'Utilities' }), TODAY)).toBe(
      false,
    );
  });

  it('shows one on Home per day, soonest charge first', () => {
    const a = makeSub({ id: 'a', startDate: '2026-01-01', nextChargeDate: '2026-12-01' });
    const b = makeSub({ id: 'b', startDate: '2026-01-01', nextChargeDate: '2026-11-25' });
    expect(homeVibeCheck([a, b], TODAY)?.id).toBe('b');
    expect(homeVibeCheck([a, { ...b, lastVibeCheckAt: TODAY }], TODAY)).toBeNull();
  });

  it('follows up by answer', () => {
    const s = makeSub({
      id: 'v',
      catalogId: 'spotify',
      name: 'Spotify',
      category: 'Music',
      planName: 'Premium',
      pricePaise: 13900,
    });
    const ctx = {
      profile: profile(),
      subscriptions: [s],
      usages: taps('v', 18),
      catalog: CATALOG,
      today: TODAY,
    };
    expect(vibeFollowUp(s, 'love', ctx)).toMatchObject({
      kind: 'pick',
      pick: { type: 'go_annual' },
    });
    expect(vibeFollowUp(s, 'not_really', ctx)).toEqual({
      kind: 'cancel',
      text: 'Save ₹1,668 a year by cancelling Spotify.',
      yearlyPaise: 166800,
    });
    const n = makeSub({
      id: 'n',
      catalogId: 'netflix',
      name: 'Netflix',
      planName: 'Premium',
      pricePaise: 64900,
    });
    const okay = vibeFollowUp(n, 'okay', { ...ctx, subscriptions: [n], usages: [] });
    expect(okay).toMatchObject({
      kind: 'pick',
      pick: { type: 'swap', planName: 'Mobile', monthlySavingPaise: 50000 },
    });
  });
});

describe('couldHaveSaved', () => {
  it('sums charges since usage went low, top 3, hidden under ₹100', () => {
    const s = makeSub({
      id: 'c',
      name: 'CineLite',
      lowUsageSince: '2026-03-01',
      status: 'cancelled',
    });
    const charges = ['2026-02-10', '2026-03-10', '2026-04-10'].map((date, i) => ({
      id: `${i}`,
      subId: 'c',
      date,
      amountPaise: 14900,
    }));
    const rows = couldHaveSaved([s], charges, [], TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0].amountPaise).toBe(29800);
    expect(rows[0].text).toBe(
      "₹298 on CineLite since March. You haven't used it in the last 30 days.",
    );
    const small = charges.map((c) => ({ ...c, amountPaise: 4000 })); // ₹80 since March
    expect(couldHaveSaved([s], small, [], TODAY)).toEqual([]);
  });
});
