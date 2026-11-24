import { describe, expect, it } from 'vitest';
import { computeBadges } from './badges';
import { priceHike, recentIncrease } from './priceHike';
import { makeSub, taps, TODAY } from './testing';

const kinds = (map: Map<string, { kind: string }[]>, id: string) => map.get(id)?.map((b) => b.kind);

describe('computeBadges', () => {
  it('puts Trial ending first and suppresses Renews soon for it', () => {
    const trial = makeSub({
      id: 'trial',
      isTrial: true,
      trialEndDate: '2026-11-24',
      nextChargeDate: '2026-11-24',
    });
    const b = computeBadges([trial], { usages: [], priceChanges: [], today: TODAY });
    expect(kinds(b, 'trial')?.[0]).toBe('trial_ending');
    expect(kinds(b, 'trial')).not.toContain('renews_soon');
    expect(b.get('trial')?.[0].why).toBe('Your free trial ends in 2 days');
  });

  it('shows Renews soon within 7 days', () => {
    const s = makeSub({ id: 'r', nextChargeDate: '2026-11-27', pricePaise: 64900 });
    const b = computeBadges([s], { usages: [], priceChanges: [], today: TODAY });
    expect(b.get('r')).toContainEqual({
      kind: 'renews_soon',
      label: 'Renews soon',
      why: '₹649 will be charged in 5 days',
    });
  });

  it('does not say Renews soon when the plan will just end', () => {
    const ending = makeSub({
      id: 'e',
      nextChargeDate: '2026-11-27',
      endDate: '2026-11-27',
      autoRenew: false,
    });
    const b = computeBadges([ending], { usages: [], priceChanges: [], today: TODAY });
    expect(kinds(b, 'e')).not.toContain('renews_soon');
  });

  it('shows Price went up for 30 days after a same-cycle increase', () => {
    const s = makeSub({ id: 'p' });
    const change = { id: 'c', subId: 'p', date: '2026-11-12', oldPaise: 14900, newPaise: 19900 };
    const ctx = { usages: [], priceChanges: [change], today: TODAY };
    expect(computeBadges([s], ctx).get('p')?.[0]).toEqual({
      kind: 'price_up',
      label: 'Price went up',
      why: 'Price went up ₹50 on 12 Nov',
    });
    expect(kinds(computeBadges([s], { ...ctx, today: '2026-12-12' }), 'p')).not.toContain(
      'price_up',
    );
    const cycle = { ...change, cycleChanged: true };
    expect(kinds(computeBadges([s], { ...ctx, priceChanges: [cycle] }), 'p')).not.toContain(
      'price_up',
    );
  });

  it('marks least and most used from taps', () => {
    const low = makeSub({ id: 'low', category: 'Fitness' });
    const high = makeSub({ id: 'high', category: 'Music' });
    const b = computeBadges([low, high], {
      usages: taps('high', 18),
      priceChanges: [],
      today: TODAY,
    });
    expect(kinds(b, 'low')).toContain('least_used');
    expect(b.get('low')?.find((x) => x.kind === 'least_used')?.why).toBe(
      'Not used in the last 30 days',
    );
    expect(kinds(b, 'high')).toContain('most_used');
  });

  it('flags duplicates per category but never for utilities', () => {
    const subs = [
      makeSub({ id: 'v1', category: 'Video' }),
      makeSub({ id: 'v2', category: 'Video' }),
      makeSub({ id: 'v3', category: 'Video' }),
      makeSub({ id: 'u1', category: 'Utilities' }),
      makeSub({ id: 'u2', category: 'Utilities' }),
    ];
    const b = computeBadges(subs, { usages: [], priceChanges: [], today: TODAY });
    expect(b.get('v1')?.find((x) => x.kind === 'duplicate')?.why).toBe(
      'You have 3 Video subscriptions',
    );
    expect(kinds(b, 'u1')).not.toContain('duplicate');
    expect(kinds(b, 'u1')).not.toContain('least_used');
  });

  it('awards Priciest and Best value only with 3+ subscriptions', () => {
    const cheap = makeSub({ id: 'cheap', category: 'Music', pricePaise: 10000 });
    const mid = makeSub({ id: 'mid', category: 'Cloud', pricePaise: 20000 });
    const dear = makeSub({ id: 'dear', category: 'Fitness', pricePaise: 90000 });
    const usages = [...taps('cheap', 20), ...taps('mid', 5), ...taps('dear', 5)];
    const b = computeBadges([cheap, mid, dear], { usages, priceChanges: [], today: TODAY });
    expect(kinds(b, 'dear')).toContain('priciest');
    expect(b.get('cheap')?.find((x) => x.kind === 'best_value')?.why).toBe(
      '₹5 per use, your best value',
    );
    const two = computeBadges([cheap, dear], { usages, priceChanges: [], today: TODAY });
    expect(kinds(two, 'dear')).not.toContain('priciest');
  });

  it('gives inactive subscriptions no badges', () => {
    const s = makeSub({ id: 'x', status: 'paused', nextChargeDate: '2026-11-23' });
    expect(computeBadges([s], { usages: [], priceChanges: [], today: TODAY }).has('x')).toBe(false);
  });
});

describe('priceHike', () => {
  it('computes the percentage and extra cost per year', () => {
    expect(priceHike(14900, 19900, 'monthly', 'monthly')).toEqual({
      oldPaise: 14900,
      newPaise: 19900,
      increasePct: 34,
      extraPerYearPaise: 60000,
    });
    expect(priceHike(10000, 12000, 'weekly', 'weekly')?.extraPerYearPaise).toBe(104000);
    expect(priceHike(100000, 120000, 'quarterly', 'quarterly')?.extraPerYearPaise).toBe(80000);
  });
  it('has no alert for a decrease or a changed cycle', () => {
    expect(priceHike(19900, 14900, 'monthly', 'monthly')).toBeNull();
    expect(priceHike(14900, 149900, 'monthly', 'yearly')).toBeNull();
  });
  it('finds the latest recent increase', () => {
    const changes = [
      { id: '1', subId: 'a', date: '2026-10-01', oldPaise: 100, newPaise: 200 },
      { id: '2', subId: 'a', date: '2026-11-10', oldPaise: 200, newPaise: 300 },
    ];
    expect(recentIncrease(changes, 'a', TODAY)?.id).toBe('2');
  });
});
