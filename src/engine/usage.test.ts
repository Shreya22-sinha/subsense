import { describe, expect, it } from 'vitest';
import { makeSub, taps, TODAY } from './testing';
import {
  costPerUsePaise,
  lowUsageUpdates,
  trackedDays,
  usageLevel,
  usageSummary,
  uses30,
  uses30ById,
} from './usage';

const newSub = (rating: number) =>
  makeSub({ createdAt: '2026-11-15T10:00:00.000Z', usageRating: rating });

describe('uses30', () => {
  const usages = [
    { id: '1', subId: 'a', date: '2026-11-22' },
    { id: '2', subId: 'a', date: '2026-10-24' }, // 29 days ago: counts
    { id: '3', subId: 'a', date: '2026-10-23' }, // 30 days ago: does not
    { id: '4', subId: 'b', date: '2026-11-20' },
  ];
  it('counts taps in the 30 days ending today', () => {
    expect(uses30(usages, 'a', TODAY)).toBe(2);
    expect(uses30ById(usages, TODAY)).toEqual(
      new Map([
        ['a', 2],
        ['b', 1],
      ]),
    );
  });
});

describe('usageLevel', () => {
  it('uses taps once tracked for 14+ days', () => {
    const s = makeSub();
    expect(trackedDays(s, TODAY)).toBeGreaterThanOrEqual(14);
    expect(usageLevel(s, 12, TODAY)).toBe('high');
    expect(usageLevel(s, 11, TODAY)).toBe('normal');
    expect(usageLevel(s, 3, TODAY)).toBe('normal');
    expect(usageLevel(s, 2, TODAY)).toBe('low');
  });

  it('uses the rating before 14 days', () => {
    expect(usageLevel(newSub(5), 0, TODAY)).toBe('high');
    expect(usageLevel(newSub(4), 0, TODAY)).toBe('normal');
    expect(usageLevel(newSub(2), 30, TODAY)).toBe('low');
  });

  it('describes the data used', () => {
    expect(usageSummary(makeSub(), 1, TODAY)).toBe('Used once in the last 30 days');
    expect(usageSummary(makeSub(), 18, TODAY)).toBe('Used 18 times in the last 30 days');
    expect(usageSummary(newSub(2), 0, TODAY)).toBe('You rated your usage 2 of 5');
  });
});

describe('costPerUsePaise', () => {
  it('divides the monthly share by taps (at least 1)', () => {
    expect(costPerUsePaise(makeSub({ pricePaise: 30000 }), 10, TODAY)).toBe(3000);
    expect(costPerUsePaise(makeSub({ pricePaise: 30000 }), 0, TODAY)).toBe(30000);
  });
  it('maps ratings 1–5 to 1, 3, 6, 10, 20 uses before taps count', () => {
    const s = (r: number) => ({ ...newSub(r), pricePaise: 60000 });
    expect([1, 2, 3, 4, 5].map((r) => costPerUsePaise(s(r), 0, TODAY))).toEqual([
      60000, 20000, 10000, 6000, 3000,
    ]);
  });
});

describe('lowUsageUpdates', () => {
  it('sets lowUsageSince when usage becomes low and clears it when it recovers', () => {
    const low = makeSub({ id: 'low' });
    const recovered = makeSub({ id: 'rec', lowUsageSince: '2026-10-01' });
    const updates = lowUsageUpdates([low, recovered], taps('rec', 15), TODAY);
    expect(updates).toEqual(
      new Map([
        ['low', TODAY],
        ['rec', null],
      ]),
    );
  });
  it('keeps the original date while still low', () => {
    const s = makeSub({ lowUsageSince: '2026-10-01' });
    expect(lowUsageUpdates([s], [], TODAY).size).toBe(0);
  });
});
