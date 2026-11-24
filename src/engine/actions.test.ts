import { describe, expect, it } from 'vitest';
import { actionBadgeCount, computeActionItems, type ActionInput } from './actions';
import { makeSub, taps, TODAY } from './testing';

const input = (patch: Partial<ActionInput>): ActionInput => ({
  subscriptions: [],
  charges: [],
  usages: [],
  priceChanges: [],
  actionStates: [],
  ...patch,
});

describe('computeActionItems', () => {
  it('Urgent: a trial ending in 0–3 days', () => {
    const s = makeSub({
      id: 't',
      name: 'CineLite',
      pricePaise: 64900,
      isTrial: true,
      trialEndDate: '2026-11-24',
      nextChargeDate: '2026-11-24',
    });
    const items = computeActionItems(input({ subscriptions: [s] }), TODAY);
    expect(items).toEqual([
      expect.objectContaining({
        id: 'urgent_t_2026-11-24',
        level: 'urgent',
        reason: 'Trial converts to ₹649 in 2 days',
      }),
    ]);
    const far = { ...s, trialEndDate: '2026-11-26', nextChargeDate: '2026-11-26' };
    expect(computeActionItems(input({ subscriptions: [far] }), TODAY)).toEqual([]);
  });

  it('Review: a charge within 7 days for a rarely used or "meh" subscription', () => {
    const rare = makeSub({ id: 'r', pricePaise: 29900, nextChargeDate: '2026-11-27' });
    const loved = makeSub({ id: 'l', nextChargeDate: '2026-11-27' });
    const meh = makeSub({ id: 'm', nextChargeDate: '2026-11-25', liking: 'meh' });
    const items = computeActionItems(
      input({ subscriptions: [rare, loved, meh], usages: [...taps('l', 10), ...taps('m', 10)] }),
      TODAY,
    );
    expect(items.map((i) => i.id)).toEqual(['review_m_2026-11-25', 'review_r_2026-11-27']);
    expect(items[1].reason).toBe('You rarely use this. ₹299 is charged in 5 days');
    expect(items[0].reason).toMatch(/^You said it.s meh\./);
  });

  it('Review: a price-hike reminder 3 days before the next charge', () => {
    const s = makeSub({ id: 'p', pricePaise: 19900, nextChargeDate: '2026-11-25' });
    const change = {
      id: 'c',
      subId: 'p',
      date: '2026-11-10',
      oldPaise: 14900,
      newPaise: 19900,
      remindAtRenewal: true,
    };
    const ctx = input({ subscriptions: [s], usages: taps('p', 10), priceChanges: [change] });
    expect(computeActionItems(ctx, TODAY)[0].reason).toBe(
      'Price went up to ₹199. ₹199 is charged in 3 days',
    );
    expect(computeActionItems(ctx, '2026-11-21')).toEqual([]); // 4 days before: not yet
  });

  it('Heads-up: a yearly charge in 8–30 days', () => {
    const s = makeSub({
      id: 'y',
      cycle: 'yearly',
      pricePaise: 149900,
      nextChargeDate: '2026-12-14',
    });
    const items = computeActionItems(input({ subscriptions: [s], usages: taps('y', 10) }), TODAY);
    expect(items).toEqual([
      expect.objectContaining({ level: 'headsup', reason: '₹1,499 yearly charge on 14 Dec' }),
    ]);
  });

  it('Ending: an end date in 0–7 days', () => {
    const s = makeSub({
      id: 'e',
      endDate: '2026-11-25',
      autoRenew: false,
      nextChargeDate: '2026-11-25',
    });
    const items = computeActionItems(input({ subscriptions: [s], usages: taps('e', 10) }), TODAY);
    expect(items.map((i) => i.level)).toEqual(['ending']);
    expect(items[0].reason).toBe('Your plan ends on 25 Nov');
  });

  it('Confirm: a rollover charge in the last 3 days, not a backfilled one', () => {
    const s = makeSub({ id: 'c', usageRating: 4 });
    const charges = [
      {
        id: 'ch1',
        subId: 'c',
        date: '2026-11-21',
        amountPaise: 64900,
        source: 'rollover' as const,
      },
      {
        id: 'ch2',
        subId: 'c',
        date: '2026-11-20',
        amountPaise: 64900,
        source: 'backfill' as const,
      },
      {
        id: 'ch3',
        subId: 'c',
        date: '2026-11-18',
        amountPaise: 64900,
        source: 'rollover' as const,
      },
    ];
    const items = computeActionItems(
      input({ subscriptions: [s], charges, usages: taps('c', 10) }),
      TODAY,
    );
    expect(items).toEqual([
      expect.objectContaining({
        id: 'confirm_c_2026-11-21',
        reason: 'Were you charged ₹649 on 21 Nov?',
        chargeId: 'ch1',
      }),
    ]);
  });

  it('orders by level and hides done or snoozed items', () => {
    const trial = makeSub({
      id: 't',
      isTrial: true,
      trialEndDate: '2026-11-23',
      nextChargeDate: '2026-11-23',
    });
    const rare = makeSub({ id: 'r', nextChargeDate: '2026-11-24' });
    const all = computeActionItems(input({ subscriptions: [rare, trial] }), TODAY);
    expect(all.map((i) => i.level)).toEqual(['urgent', 'review']);
    expect(actionBadgeCount(all)).toBe(2);

    const done = [{ itemId: 'urgent_t_2026-11-23', state: 'done' as const, until: '2026-11-23' }];
    expect(
      computeActionItems(input({ subscriptions: [rare, trial], actionStates: done }), TODAY),
    ).toHaveLength(1);

    const snoozed = [
      { itemId: 'review_r_2026-11-24', state: 'snoozed' as const, until: '2026-11-23' },
    ];
    const ctx = input({ subscriptions: [rare], actionStates: snoozed });
    expect(computeActionItems(ctx, TODAY)).toHaveLength(0);
    expect(computeActionItems(ctx, '2026-11-23')).toHaveLength(1); // back the next demo day
  });

  it('ignores paused and cancelled subscriptions', () => {
    const s = makeSub({ status: 'paused', isTrial: true, trialEndDate: '2026-11-23' });
    expect(computeActionItems(input({ subscriptions: [s] }), TODAY)).toEqual([]);
  });
});
