import { describe, expect, it } from 'vitest';
import {
  addCycles,
  daysUntil,
  monthlyEquivalentPaise,
  monthlyShareOf,
  nextChargeDate,
  relativeDayLabel,
  sharePaise,
  trialEndDate,
} from './dates';

describe('monthlyEquivalentPaise', () => {
  it('converts each cycle', () => {
    expect(monthlyEquivalentPaise(12000, 'weekly')).toBe(52000);
    expect(monthlyEquivalentPaise(64900, 'monthly')).toBe(64900);
    expect(monthlyEquivalentPaise(30000, 'quarterly')).toBe(10000);
    expect(monthlyEquivalentPaise(149900, 'yearly')).toBe(12492);
    expect(monthlyEquivalentPaise(50000, 'one_time')).toBe(0);
  });
});

describe('share', () => {
  it('divides price between people', () => {
    expect(sharePaise(64900, 1)).toBe(64900);
    expect(sharePaise(60000, 4)).toBe(15000);
    expect(sharePaise(60000, 0)).toBe(60000);
  });
  it('monthly share combines share and cycle', () => {
    expect(monthlyShareOf({ pricePaise: 120000, cycle: 'yearly', sharedWith: 2 })).toBe(5000);
  });
});

describe('addCycles', () => {
  it('clamps month ends instead of overflowing', () => {
    expect(addCycles('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
    expect(addCycles('2028-01-31', 'monthly', 1)).toBe('2028-02-29');
    expect(addCycles('2026-11-30', 'quarterly', 1)).toBe('2027-02-28');
  });
  it('handles weeks and years', () => {
    expect(addCycles('2026-11-22', 'weekly', 2)).toBe('2026-12-06');
    expect(addCycles('2028-02-29', 'yearly', 1)).toBe('2029-02-28');
  });
});

describe('trialEndDate', () => {
  it('is start + length in days', () => {
    expect(trialEndDate('2026-11-22', 7)).toBe('2026-11-29');
    expect(trialEndDate('2026-12-28', 7)).toBe('2027-01-04');
  });
});

describe('nextChargeDate', () => {
  const base = { isTrial: false, trialEndDate: null } as const;

  it('returns the start date when it is today or in the future', () => {
    expect(
      nextChargeDate({ ...base, startDate: '2026-11-22', cycle: 'monthly' }, '2026-11-22'),
    ).toBe('2026-11-22');
    expect(
      nextChargeDate({ ...base, startDate: '2026-12-05', cycle: 'monthly' }, '2026-11-22'),
    ).toBe('2026-12-05');
  });

  it('finds the first date on or after today in the series', () => {
    expect(
      nextChargeDate({ ...base, startDate: '2026-01-15', cycle: 'monthly' }, '2026-11-22'),
    ).toBe('2026-12-15');
    expect(
      nextChargeDate({ ...base, startDate: '2026-01-22', cycle: 'monthly' }, '2026-11-22'),
    ).toBe('2026-11-22');
    expect(
      nextChargeDate({ ...base, startDate: '2024-03-10', cycle: 'yearly' }, '2026-11-22'),
    ).toBe('2027-03-10');
    expect(
      nextChargeDate({ ...base, startDate: '2026-11-01', cycle: 'weekly' }, '2026-11-22'),
    ).toBe('2026-11-22');
  });

  it('does not drift after a clamped month', () => {
    // 31 Jan series: Feb 28, Mar 31 (not Mar 28).
    expect(
      nextChargeDate({ ...base, startDate: '2026-01-31', cycle: 'monthly' }, '2026-03-01'),
    ).toBe('2026-03-31');
  });

  it('uses the trial end as the first charge', () => {
    expect(
      nextChargeDate(
        { startDate: '2026-11-20', cycle: 'monthly', isTrial: true, trialEndDate: '2026-11-27' },
        '2026-11-22',
      ),
    ).toBe('2026-11-27');
  });

  it('returns null for one-time items', () => {
    expect(
      nextChargeDate({ ...base, startDate: '2026-11-22', cycle: 'one_time' }, '2026-11-22'),
    ).toBeNull();
  });
});

describe('relative labels', () => {
  const today = '2026-11-22';
  it('formats near and far dates', () => {
    expect(relativeDayLabel('2026-11-22', today)).toBe('today');
    expect(relativeDayLabel('2026-11-23', today)).toBe('tomorrow');
    expect(relativeDayLabel('2026-11-25', today)).toBe('in 3 days');
    expect(relativeDayLabel('2026-12-06', today)).toBe('in 2 weeks');
    expect(relativeDayLabel('2027-01-10', today)).toBe('10 Jan 2027');
    expect(daysUntil('2026-11-20', today)).toBe(-2);
  });
});
