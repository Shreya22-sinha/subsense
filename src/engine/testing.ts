/** Test fixtures for engine tests. Not imported by app code. */
import type { Subscription } from '@/types/models';

export const TODAY = '2026-11-22';

let counter = 0;

/** An active monthly subscription created 60 days before TODAY, with overrides. */
export function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  counter += 1;
  return {
    id: `s${counter}`,
    catalogId: null,
    name: `Service ${counter}`,
    planName: '',
    category: 'Video',
    pricePaise: 29900,
    cycle: 'monthly',
    startDate: '2026-09-10',
    isTrial: false,
    trialDays: null,
    trialEndDate: null,
    nextChargeDate: '2026-12-10',
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
    createdAt: '2026-09-23T06:30:00.000Z',
    updatedAt: '2026-09-23T06:30:00.000Z',
    cancelledAt: null,
    ...overrides,
  };
}

/** `n` Usage records for a subscription, one per day ending TODAY. */
export function taps(subId: string, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(`${TODAY}T12:00:00`);
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { id: `${subId}-u${i}`, subId, date: iso };
  });
}
