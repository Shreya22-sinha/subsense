import { describe, expect, it } from 'vitest';
import type { Subscription } from '@/types/models';
import { DEFAULT_QUERY, querySubscriptions } from './subscriptionList';

const base = {
  sharedWith: 1,
  usageRating: 3,
  isTrial: false,
  planName: '',
  cycle: 'monthly',
} as const;
const subs = [
  {
    ...base,
    id: 'a',
    name: 'Netflix',
    planName: 'Premium',
    category: 'Video',
    pricePaise: 64900,
    status: 'active',
    nextChargeDate: '2026-12-01',
  },
  {
    ...base,
    id: 'b',
    name: 'Spotify',
    category: 'Music',
    pricePaise: 13900,
    status: 'active',
    nextChargeDate: '2026-11-25',
    usageRating: 5,
  },
  {
    ...base,
    id: 'c',
    name: 'CineLite',
    category: 'Video',
    pricePaise: 14900,
    status: 'active',
    isTrial: true,
    nextChargeDate: '2026-11-24',
  },
  {
    ...base,
    id: 'd',
    name: 'Audible',
    category: 'Reading',
    pricePaise: 19900,
    status: 'paused',
    nextChargeDate: '2026-11-23',
  },
  {
    ...base,
    id: 'e',
    name: 'Kindle',
    category: 'Reading',
    pricePaise: 16900,
    status: 'cancelled',
    nextChargeDate: null,
  },
  {
    ...base,
    id: 'f',
    name: 'Prime',
    category: 'Video',
    pricePaise: 149900,
    cycle: 'yearly',
    status: 'active',
    nextChargeDate: '2027-01-10',
  },
] as unknown as Subscription[];

const ids = (list: Subscription[]) => list.map((s) => s.id);
const none = new Map<string, number>();

describe('querySubscriptions', () => {
  it('sorts by next charge by default, inactive last', () => {
    expect(ids(querySubscriptions(subs, DEFAULT_QUERY, none))).toEqual([
      'c',
      'b',
      'a',
      'f',
      'd',
      'e',
    ]);
  });

  it('searches name and plan name, case-insensitively', () => {
    expect(ids(querySubscriptions(subs, { ...DEFAULT_QUERY, search: 'prem' }, none))).toEqual([
      'a',
    ]);
    expect(ids(querySubscriptions(subs, { ...DEFAULT_QUERY, search: 'SPOT' }, none))).toEqual([
      'b',
    ]);
  });

  it('filters by status chips', () => {
    const q = (status: typeof DEFAULT_QUERY.status) =>
      ids(querySubscriptions(subs, { ...DEFAULT_QUERY, status, sort: 'name' }, none));
    expect(q('active')).toEqual(['c', 'a', 'f', 'b']);
    expect(q('trials')).toEqual(['c']);
    expect(q('paused')).toEqual(['d']);
    expect(q('cancelled')).toEqual(['e']);
  });

  it('filters by category', () => {
    expect(
      ids(querySubscriptions(subs, { ...DEFAULT_QUERY, category: 'Reading', sort: 'name' }, none)),
    ).toEqual(['d', 'e']);
  });

  it('sorts by monthly price both ways', () => {
    const desc = ids(querySubscriptions(subs, { ...DEFAULT_QUERY, sort: 'price_desc' }, none));
    expect(desc.slice(0, 2)).toEqual(['a', 'd']); // 649 > 199 > 169 > 149 > 139 > 125 (yearly)
    const asc = ids(querySubscriptions(subs, { ...DEFAULT_QUERY, sort: 'price_asc' }, none));
    expect(asc[0]).toBe('f');
  });

  it('sorts by usage, then rating', () => {
    const uses = new Map([['a', 10]]);
    expect(
      ids(querySubscriptions(subs, { ...DEFAULT_QUERY, sort: 'most_used' }, uses)).slice(0, 2),
    ).toEqual(['a', 'b']);
  });
});
