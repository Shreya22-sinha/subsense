import { describe, expect, it } from 'vitest';
import type { Activity, Charge, Saving } from '@/types/models';
import {
  categoryBreakdown,
  costPerUseTop,
  decisionsInMonth,
  highlights,
  monthEnd,
  savedInMonth,
  scheduledRestOfMonth,
  shiftMonth,
  shouldLogBudgetExceeded,
  spendTrend,
  spentInMonth,
  totalSaved,
  upcomingCharges,
  wasActiveOn,
} from './insights';
import { makeSub, taps, TODAY } from './testing';

const charge = (subId: string, date: string, amountPaise: number): Charge => ({
  id: `${subId}-${date}`,
  subId,
  date,
  amountPaise,
});
const saving = (
  subId: string,
  startDate: string,
  monthlyPaise: number,
  source: Saving['source'] = 'cancel',
): Saving => ({
  id: `${subId}-sv`,
  subId,
  monthlyPaise,
  startDate,
  source,
});
const activity = (type: Activity['type'], at: string): Activity => ({
  id: at + type,
  type,
  at,
  data: {},
  text: '',
});

describe('months', () => {
  it('shifts across years and finds month ends', () => {
    expect(shiftMonth('2026-11', 2)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthEnd('2028-02')).toBe('2028-02-29');
  });
});

describe('spend', () => {
  const charges = [
    charge('a', '2026-11-05', 64900),
    charge('b', '2026-11-20', 13900),
    charge('a', '2026-10-05', 64900),
  ];

  it('sums charges dated in the month', () => {
    expect(spentInMonth(charges, '2026-11')).toBe(78800);
    expect(spentInMonth(charges, '2026-09')).toBe(0);
  });

  it('projects charges still scheduled before month end', () => {
    const subs = [
      makeSub({ id: 'a', nextChargeDate: '2026-11-28', pricePaise: 29900 }),
      makeSub({ id: 'w', cycle: 'weekly', nextChargeDate: '2026-11-23', pricePaise: 10000 }),
      makeSub({ id: 'later', nextChargeDate: '2026-12-02' }),
      makeSub({ id: 'paused', status: 'paused', nextChargeDate: '2026-11-25' }),
    ];
    const scheduled = scheduledRestOfMonth(subs, TODAY);
    expect(scheduled.map((c) => `${c.subId}@${c.date}`)).toEqual([
      'a@2026-11-28',
      'w@2026-11-23',
      'w@2026-11-30',
    ]);
  });

  it('builds a 6-month trend with only the current month projected', () => {
    const subs = [makeSub({ id: 'a', nextChargeDate: '2026-11-28', pricePaise: 29900 })];
    const trend = spendTrend('2026-11', charges, subs, TODAY);
    expect(trend.map((t) => t.month)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
    ]);
    expect(trend.at(-1)).toEqual({ month: '2026-11', spent: 78800, projected: 29900 });
    expect(trend.at(-2)?.projected).toBe(0);
  });
});

describe('savings and decisions', () => {
  const savings = [saving('a', '2026-09-15', 14900), saving('b', '2026-11-10', 29900)];

  it('counts savings in effect during a month', () => {
    expect(savedInMonth(savings, '2026-08')).toBe(0);
    expect(savedInMonth(savings, '2026-10')).toBe(14900);
    expect(savedInMonth(savings, '2026-11')).toBe(44800);
  });

  it('totals monthly amount x full months since start', () => {
    expect(totalSaved(savings, TODAY)).toBe(14900 * 2);
  });

  it('counts decisions and accepted recommendations in the month', () => {
    const acts = [
      activity('decision_made', '2026-11-03T10:00:00.000Z'),
      activity('recommendation_accepted', '2026-11-04T10:00:00.000Z'),
      activity('usage_logged', '2026-11-04T10:00:00.000Z'),
      activity('decision_made', '2026-10-03T10:00:00.000Z'),
    ];
    expect(decisionsInMonth(acts, '2026-11')).toBe(2);
  });
});

describe('categoryBreakdown', () => {
  it('groups monthly shares of subscriptions active on the date', () => {
    const subs = [
      makeSub({ category: 'Video', pricePaise: 30000 }),
      makeSub({ category: 'Video', pricePaise: 10000 }),
      makeSub({ category: 'Music', pricePaise: 10000 }),
      makeSub({ category: 'Music', status: 'cancelled', cancelledAt: '2026-10-01' }),
    ];
    expect(categoryBreakdown(subs, TODAY)).toEqual([
      { category: 'Video', monthlyPaise: 40000, share: 0.8 },
      { category: 'Music', monthlyPaise: 10000, share: 0.2 },
    ]);
  });

  it('knows when cancelled and ended subscriptions were active', () => {
    const cancelled = makeSub({ status: 'cancelled', cancelledAt: '2026-10-15' });
    expect(wasActiveOn(cancelled, '2026-10-14')).toBe(true);
    expect(wasActiveOn(cancelled, '2026-10-15')).toBe(false);
    const ended = makeSub({ status: 'ended', endDate: '2026-10-31' });
    expect(wasActiveOn(ended, '2026-10-31')).toBe(true);
    expect(wasActiveOn(makeSub({ startDate: '2026-12-01' }), TODAY)).toBe(false);
  });
});

describe('costPerUseTop', () => {
  it('ranks by cost per use, highest first, without utilities', () => {
    const a = makeSub({ id: 'a', pricePaise: 30000 });
    const b = makeSub({ id: 'b', pricePaise: 30000 });
    const u = makeSub({ id: 'u', category: 'Utilities', pricePaise: 90000 });
    const top = costPerUseTop([a, b, u], [...taps('a', 10), ...taps('b', 2)], TODAY);
    expect(top.map((t) => [t.sub.id, t.costPaise])).toEqual([
      ['b', 15000],
      ['a', 3000],
    ]);
  });
});

describe('highlights', () => {
  it('writes the first 3 that apply, in order', () => {
    const subs = [
      makeSub({
        id: 'v',
        name: 'Netflix',
        category: 'Video',
        pricePaise: 50000,
        nextChargeDate: '2026-12-10',
      }),
      makeSub({
        id: 's',
        name: 'Spotify',
        category: 'Music',
        pricePaise: 10000,
        nextChargeDate: '2026-12-10',
      }),
    ];
    const data = {
      subscriptions: subs,
      charges: [charge('v', '2026-10-10', 100000), charge('v', '2026-11-10', 50000)],
      savings: [
        saving('x', '2026-11-05', 14900),
        saving('y', '2026-11-06', 29900, 'trial_stopped'),
      ],
      usages: taps('s', 22),
    };
    expect(highlights('2026-11', data, TODAY)).toEqual([
      'You cancelled 2 subscriptions and saved ₹448/month.',
      'You stopped 1 trial before it charged you ₹299.',
      'You spent 50% less than October.',
    ]);
  });

  it('falls through to top category and most used', () => {
    const subs = [
      makeSub({
        id: 's',
        name: 'Spotify',
        category: 'Music',
        pricePaise: 10000,
        nextChargeDate: '2026-12-10',
      }),
    ];
    const lines = highlights(
      '2026-11',
      { subscriptions: subs, charges: [], savings: [], usages: taps('s', 22) },
      TODAY,
    );
    expect(lines).toEqual([
      'Music is 100% of your spend.',
      'Spotify was your most used subscription (22 uses).',
    ]);
  });
});

describe('shouldLogBudgetExceeded', () => {
  it('logs once per calendar month when over budget', () => {
    expect(shouldLogBudgetExceeded(210000, 200000, [], TODAY)).toBe(true);
    expect(shouldLogBudgetExceeded(200000, 200000, [], TODAY)).toBe(false);
    const thisMonth = [activity('budget_exceeded', '2026-11-02T10:00:00.000Z')];
    expect(shouldLogBudgetExceeded(210000, 200000, thisMonth, TODAY)).toBe(false);
    const lastMonth = [activity('budget_exceeded', '2026-10-02T10:00:00.000Z')];
    expect(shouldLogBudgetExceeded(210000, 200000, lastMonth, TODAY)).toBe(true);
  });
});

describe('upcomingCharges', () => {
  it('lists charges in the next 7 days, soonest first, skipping ones that will not happen', () => {
    const subs = [
      makeSub({ id: 'a', nextChargeDate: '2026-11-29', pricePaise: 29900 }),
      makeSub({ id: 'w', cycle: 'weekly', nextChargeDate: '2026-11-22', pricePaise: 10000 }),
      makeSub({ id: 'late', nextChargeDate: '2026-11-30' }),
      makeSub({ id: 'ends', nextChargeDate: '2026-11-25', autoRenew: false }),
      makeSub({ id: 'p', status: 'paused', nextChargeDate: '2026-11-24' }),
    ];
    expect(upcomingCharges(subs, TODAY).map((c) => `${c.subId}@${c.date}`)).toEqual([
      'w@2026-11-22',
      'a@2026-11-29',
      'w@2026-11-29',
    ]);
  });
});
