/** Search, filter and sort for My Subscriptions (PRD 6.6). */
import type { Category, Subscription } from '@/types/models';
import { monthlyShareOf } from './dates';

export type StatusFilter = 'all' | 'active' | 'trials' | 'paused' | 'cancelled';
export type SortKey =
  'next_charge' | 'price_desc' | 'price_asc' | 'most_used' | 'least_used' | 'name';

export interface ListQuery {
  search: string;
  status: StatusFilter;
  category: Category | 'all';
  sort: SortKey;
}

export const DEFAULT_QUERY: ListQuery = {
  search: '',
  status: 'all',
  category: 'all',
  sort: 'next_charge',
};

function matchesStatus(s: Subscription, status: StatusFilter): boolean {
  switch (status) {
    case 'all':
      return true;
    case 'active':
      return s.status === 'active';
    case 'trials':
      return s.status === 'active' && s.isTrial;
    case 'paused':
      return s.status === 'paused';
    case 'cancelled':
      return s.status === 'cancelled';
  }
}

/** Inactive subscriptions sort after active ones for date-based ordering. */
function nextChargeKey(s: Subscription): string {
  return s.status === 'active' && s.nextChargeDate ? s.nextChargeDate : '9999-12-31';
}

export function querySubscriptions(
  subs: Subscription[],
  query: ListQuery,
  usesById: Map<string, number>,
): Subscription[] {
  const needle = query.search.trim().toLowerCase();
  const uses = (s: Subscription) => usesById.get(s.id) ?? 0;
  const byName = (a: Subscription, b: Subscription) => a.name.localeCompare(b.name);

  const compare: Record<SortKey, (a: Subscription, b: Subscription) => number> = {
    next_charge: (a, b) => nextChargeKey(a).localeCompare(nextChargeKey(b)) || byName(a, b),
    price_desc: (a, b) => monthlyShareOf(b) - monthlyShareOf(a) || byName(a, b),
    price_asc: (a, b) => monthlyShareOf(a) - monthlyShareOf(b) || byName(a, b),
    // Tap counts first, then the 1–5 rating as a tie-break (tap data starts in step 5).
    most_used: (a, b) => uses(b) - uses(a) || b.usageRating - a.usageRating || byName(a, b),
    least_used: (a, b) => uses(a) - uses(b) || a.usageRating - b.usageRating || byName(a, b),
    name: byName,
  };

  return subs
    .filter(
      (s) =>
        matchesStatus(s, query.status) &&
        (query.category === 'all' || s.category === query.category) &&
        (!needle ||
          s.name.toLowerCase().includes(needle) ||
          s.planName.toLowerCase().includes(needle)),
    )
    .sort(compare[query.sort]);
}

export function isFiltered(query: ListQuery): boolean {
  return query.search.trim() !== '' || query.status !== 'all' || query.category !== 'all';
}
