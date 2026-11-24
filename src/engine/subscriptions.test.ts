import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '@/types/models';
import {
  applyEdit,
  buildSubscription,
  createSubscription,
  subscriptionFromCatalog,
} from './subscriptions';

const ctx = {
  id: 'sub-1',
  today: '2026-11-22',
  now: '2026-11-22T10:00:00.000Z',
  defaultReminderDays: 3 as const,
};

const netflix = {
  name: ' Netflix ',
  category: 'Video' as const,
  pricePaise: 64900,
  cycle: 'monthly' as const,
  startDate: '2026-10-05',
};

describe('buildSubscription', () => {
  it('fills PRD defaults and sets the first charge date', () => {
    const s = buildSubscription(netflix, ctx);
    expect(s).toMatchObject({
      id: 'sub-1',
      name: 'Netflix',
      autoRenew: true,
      sharedWith: 1,
      usageRating: 3,
      reminderDays: 3,
      status: 'active',
      isTrial: false,
      trialEndDate: null,
      nextChargeDate: '2026-10-05',
      datesConfirmed: true,
    });
  });

  it('defaults trial length to 7 days', () => {
    const s = buildSubscription({ ...netflix, isTrial: true }, ctx);
    expect(s.trialDays).toBe(7);
  });
});

describe('createSubscription', () => {
  it('records payments already made and finds the next charge', () => {
    const { sub, charges } = createSubscription(netflix, ctx);
    expect(charges.map((c) => c.date)).toEqual(['2026-10-05', '2026-11-05']);
    expect(sub.nextChargeDate).toBe('2026-12-05');
  });

  it('treats a charge due today as paid', () => {
    const { sub, charges } = createSubscription({ ...netflix, startDate: '2026-11-22' }, ctx);
    expect(charges.map((c) => c.date)).toEqual(['2026-11-22']);
    expect(sub.nextChargeDate).toBe('2026-12-22');
  });

  it('records nothing for a future start date', () => {
    const { sub, charges } = createSubscription({ ...netflix, startDate: '2026-12-01' }, ctx);
    expect(charges).toEqual([]);
    expect(sub.nextChargeDate).toBe('2026-12-01');
  });

  it('gives a 7-day trial the right end date, charged at its end', () => {
    const { sub, charges } = createSubscription(
      { ...netflix, startDate: '2026-11-22', isTrial: true, trialDays: 7 },
      ctx,
    );
    expect(sub.trialEndDate).toBe('2026-11-29');
    expect(sub.nextChargeDate).toBe('2026-11-29');
    expect(sub.isTrial).toBe(true);
    expect(charges).toEqual([]);
  });

  it('converts a trial that already ended', () => {
    const { sub, events } = createSubscription(
      { ...netflix, startDate: '2026-11-01', isTrial: true, trialDays: 7 },
      ctx,
    );
    expect(events[0]).toMatchObject({ type: 'trial_converted', date: '2026-11-08' });
    expect(sub.isTrial).toBe(false);
    expect(sub.nextChargeDate).toBe('2026-12-08');
  });

  it('applies a next-charge override', () => {
    const { sub } = createSubscription(netflix, ctx, { nextChargeOverride: '2026-12-01' });
    expect(sub.nextChargeDate).toBe('2026-12-01');
  });
});

describe('subscriptionFromCatalog', () => {
  it('uses the first plan, is paid today and asks to confirm dates', () => {
    const item: CatalogItem = {
      id: 'spotify',
      name: 'Spotify',
      category: 'Music',
      plans: [{ name: 'Premium Individual', cycle: 'monthly', pricePaise: 13900 }],
      officialUrl: '',
      cancelUrl: '',
      lastVerified: null,
    };
    const { sub, charges } = subscriptionFromCatalog(item, ctx);
    expect(sub).toMatchObject({
      catalogId: 'spotify',
      planName: 'Premium Individual',
      pricePaise: 13900,
      startDate: '2026-11-22',
      nextChargeDate: '2026-12-22',
      datesConfirmed: false,
    });
    expect(charges).toEqual([{ date: '2026-11-22', amountPaise: 13900 }]);
  });
});

describe('applyEdit', () => {
  const editCtx = { today: '2026-11-22', now: '2026-11-22T12:00:00.000Z', chargedToday: false };
  const original = createSubscription(netflix, ctx).sub;

  it('lists changed fields and reports a price change', () => {
    const r = applyEdit(original, { ...netflix, pricePaise: 79900, planName: 'Premium' }, editCtx);
    expect(r.changedFields).toEqual(['planName', 'pricePaise']);
    expect(r.priceChange).toEqual({ oldPaise: 64900, newPaise: 79900, sameCycle: true });
    expect(r.sub.nextChargeDate).toBe('2026-12-05');
    expect(r.sub.datesConfirmed).toBe(true);
  });

  it('flags a cycle change on a price change', () => {
    const r = applyEdit(original, { ...netflix, pricePaise: 649900, cycle: 'yearly' }, editCtx);
    expect(r.priceChange?.sameCycle).toBe(false);
  });

  it('recalculates the next charge when the schedule changes', () => {
    const r = applyEdit(original, { ...netflix, startDate: '2026-10-20' }, editCtx);
    expect(r.sub.nextChargeDate).toBe('2026-12-20');
    expect(r.changedFields).toEqual(['startDate', 'nextChargeDate']);
  });

  it('skips today when today was already charged', () => {
    const r = applyEdit(
      original,
      { ...netflix, startDate: '2026-10-22' },
      { ...editCtx, chargedToday: true },
    );
    expect(r.sub.nextChargeDate).toBe('2026-12-22');
  });

  it('keeps the next charge when nothing schedule-related changed', () => {
    const r = applyEdit(original, { ...netflix, notes: 'shared login' }, editCtx);
    expect(r.sub.nextChargeDate).toBe(original.nextChargeDate);
    expect(r.priceChange).toBeNull();
  });

  it('honours an override', () => {
    const r = applyEdit(original, netflix, editCtx, { nextChargeOverride: '2026-12-01' });
    expect(r.sub.nextChargeDate).toBe('2026-12-01');
  });
});
