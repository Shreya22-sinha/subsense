import { describe, expect, it } from 'vitest';
import type { Subscription } from '@/types/models';
import { rollover } from './rollover';

function sub(overrides: Partial<Subscription>): Subscription {
  return {
    id: 's1',
    catalogId: null,
    name: 'Netflix',
    planName: '',
    category: 'Video',
    pricePaise: 64900,
    cycle: 'monthly',
    startDate: '2026-09-10',
    isTrial: false,
    trialDays: null,
    trialEndDate: null,
    nextChargeDate: '2026-11-10',
    endDate: null,
    autoRenew: true,
    sharedWith: 1,
    paidWith: '',
    usageRating: 3,
    liking: null,
    reminderDays: 3,
    notes: '',
    status: 'active',
    lowUsageSince: null,
    lastVibeCheckAt: null,
    datesConfirmed: true,
    createdAt: '',
    updatedAt: '',
    cancelledAt: null,
    ...overrides,
  };
}

describe('rollover', () => {
  it('does nothing when the next charge is today or later', () => {
    const r = rollover(sub({ nextChargeDate: '2026-11-22' }), '2026-11-22');
    expect(r.charges).toEqual([]);
    expect(r.sub.nextChargeDate).toBe('2026-11-22');
  });

  it('with inclusive, charges a payment due today', () => {
    const r = rollover(sub({ nextChargeDate: '2026-11-22' }), '2026-11-22', { inclusive: true });
    expect(r.charges).toEqual([{ date: '2026-11-22', amountPaise: 64900 }]);
    expect(r.sub.nextChargeDate).toBe('2026-12-22');
  });

  it('records every missed charge and moves forward until on/after today', () => {
    const r = rollover(sub({ nextChargeDate: '2026-09-10' }), '2026-11-22');
    expect(r.charges.map((c) => c.date)).toEqual(['2026-09-10', '2026-10-10', '2026-11-10']);
    expect(r.events.every((e) => e.type === 'charged')).toBe(true);
    expect(r.sub.nextChargeDate).toBe('2026-12-10');
  });

  it('keeps month-end billing dates from drifting', () => {
    const r = rollover(
      sub({ startDate: '2026-01-31', nextChargeDate: '2026-01-31', chargeAnchor: '2026-01-31' }),
      '2026-05-01',
    );
    expect(r.charges.map((c) => c.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
    expect(r.sub.nextChargeDate).toBe('2026-05-31');
  });

  it('keeps counting from the trial end after a trial converts', () => {
    const converted = rollover(
      sub({
        startDate: '2026-01-24',
        isTrial: true,
        trialEndDate: '2026-01-31',
        nextChargeDate: '2026-01-31',
        chargeAnchor: '2026-01-31',
      }),
      '2026-03-05',
    );
    expect(converted.charges.map((c) => c.date)).toEqual(['2026-01-31', '2026-02-28']);
    expect(converted.sub.nextChargeDate).toBe('2026-03-31');
  });

  it('charges the user share only', () => {
    const r = rollover(sub({ pricePaise: 60000, sharedWith: 4 }), '2026-11-22');
    expect(r.charges[0].amountPaise).toBe(15000);
  });

  it('converts a trial at its end date', () => {
    const r = rollover(
      sub({
        startDate: '2026-11-10',
        isTrial: true,
        trialDays: 7,
        trialEndDate: '2026-11-17',
        nextChargeDate: '2026-11-17',
      }),
      '2026-11-22',
    );
    expect(r.events).toEqual([{ type: 'trial_converted', date: '2026-11-17', amountPaise: 64900 }]);
    expect(r.sub.isTrial).toBe(false);
    expect(r.sub.nextChargeDate).toBe('2026-12-17');
  });

  it('ends a trial with auto-renew off without charging', () => {
    const r = rollover(
      sub({
        startDate: '2026-11-10',
        isTrial: true,
        trialEndDate: '2026-11-17',
        nextChargeDate: '2026-11-17',
        autoRenew: false,
      }),
      '2026-11-22',
    );
    expect(r.charges).toEqual([]);
    expect(r.sub.status).toBe('ended');
    expect(r.events).toEqual([{ type: 'subscription_ended', date: '2026-11-17' }]);
  });

  it('charges the first purchase but does not renew with auto-renew off', () => {
    const r = rollover(
      sub({
        startDate: '2026-08-01',
        cycle: 'quarterly',
        nextChargeDate: '2026-08-01',
        autoRenew: false,
      }),
      '2026-11-22',
    );
    expect(r.charges.map((c) => c.date)).toEqual(['2026-08-01']);
    expect(r.sub.status).toBe('ended');
    expect(r.events.at(-1)).toEqual({ type: 'subscription_ended', date: '2026-11-01' });
  });

  it('stops renewing at the end date', () => {
    const r = rollover(sub({ nextChargeDate: '2026-10-10', endDate: '2026-11-10' }), '2026-11-22');
    expect(r.charges.map((c) => c.date)).toEqual(['2026-10-10']);
    expect(r.sub.status).toBe('ended');
  });

  it('ends a subscription whose end date has passed even without a due charge', () => {
    const r = rollover(sub({ nextChargeDate: '2026-12-10', endDate: '2026-11-20' }), '2026-11-22');
    expect(r.sub.status).toBe('ended');
    expect(r.events).toEqual([{ type: 'subscription_ended', date: '2026-11-20' }]);
  });

  it('keeps an end date of today active', () => {
    const r = rollover(sub({ nextChargeDate: '2026-12-10', endDate: '2026-11-22' }), '2026-11-22');
    expect(r.sub.status).toBe('active');
  });

  it('leaves paused and cancelled subscriptions alone', () => {
    expect(
      rollover(sub({ status: 'paused', nextChargeDate: '2026-01-01' }), '2026-11-22').charges,
    ).toEqual([]);
    expect(
      rollover(sub({ status: 'cancelled', nextChargeDate: '2026-01-01' }), '2026-11-22').charges,
    ).toEqual([]);
  });

  it('charges a one-time purchase once', () => {
    const r = rollover(
      sub({ cycle: 'one_time', startDate: '2026-11-01', nextChargeDate: '2026-11-01' }),
      '2026-11-22',
    );
    expect(r.charges.map((c) => c.date)).toEqual(['2026-11-01']);
    expect(r.sub.nextChargeDate).toBeNull();
    expect(r.sub.status).toBe('active');
  });
});
