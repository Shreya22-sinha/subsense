import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search, SearchX, SlidersHorizontal, Wallet } from 'lucide-react';
import { AddButton } from '@/components/layout/AddButton';
import { Screen } from '@/components/layout/Screen';
import { SubscriptionCard } from '@/components/subscriptions/SubscriptionCard';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { monthlyTotalPaise } from '@/engine/dates';
import {
  DEFAULT_QUERY,
  isFiltered,
  querySubscriptions,
  type ListQuery,
  type SortKey,
  type StatusFilter,
} from '@/engine/subscriptionList';
import { useBadges, useUses30 } from '@/hooks/useDerived';
import { cn } from '@/lib/cn';
import { formatRs } from '@/lib/format';
import { useToday } from '@/store/clockStore';
import { useDataStore } from '@/store/dataStore';
import { CATEGORIES, type Category } from '@/types/models';

const STATUS_CHIPS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'trials', label: 'Trials' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: 'next_charge', label: 'Next charge' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'most_used', label: 'Most used' },
  { value: 'least_used', label: 'Least used' },
  { value: 'name', label: 'Name' },
];

/** Filters live in the URL so Back from a detail page keeps them. */
function useListQuery(): [ListQuery, (patch: Partial<ListQuery>) => void] {
  const [params, setParams] = useSearchParams();
  // Ignore unknown values from a hand-edited URL.
  const pick = <T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T =>
    allowed.includes(raw as T) ? (raw as T) : fallback;
  const query: ListQuery = {
    search: params.get('q') ?? DEFAULT_QUERY.search,
    status: pick(
      params.get('status'),
      STATUS_CHIPS.map((c) => c.value),
      DEFAULT_QUERY.status,
    ),
    category: pick<Category | 'all'>(params.get('cat'), CATEGORIES, DEFAULT_QUERY.category),
    sort: pick(
      params.get('sort'),
      SORTS.map((s) => s.value),
      DEFAULT_QUERY.sort,
    ),
  };
  const update = (patch: Partial<ListQuery>) => {
    const next = { ...query, ...patch };
    const p: Record<string, string> = {};
    if (next.search) p.q = next.search;
    if (next.status !== DEFAULT_QUERY.status) p.status = next.status;
    if (next.category !== DEFAULT_QUERY.category) p.cat = next.category;
    if (next.sort !== DEFAULT_QUERY.sort) p.sort = next.sort;
    setParams(p, { replace: true });
  };
  return [query, update];
}

/** My Subscriptions (PRD 6.6). */
export default function Subscriptions() {
  const today = useToday();
  const subscriptions = useDataStore((s) => s.subscriptions);
  const [query, update] = useListQuery();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const usesById = useUses30();
  const badges = useBadges();
  const results = useMemo(
    () => querySubscriptions(subscriptions, query, usesById),
    // query is rebuilt from the URL each render; compare its parts
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subscriptions, usesById, query.search, query.status, query.category, query.sort],
  );
  const refined = query.category !== 'all' || query.sort !== DEFAULT_QUERY.sort;
  const activeCount = subscriptions.filter((s) => s.status === 'active').length;
  const total = monthlyTotalPaise(subscriptions);

  return (
    <Screen title="Subscriptions" actions={<AddButton />}>
      {subscriptions.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Add your first subscription to see your real monthly total"
          action={<ButtonLink to="/subs/new">Add subscription</ButtonLink>}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-base font-semibold text-ink" aria-live="polite">
            {activeCount} active · {formatRs(total)}/month
          </p>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                size={18}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-muted"
              />
              <input
                type="search"
                aria-label="Search subscriptions"
                placeholder="Search by name or plan"
                value={query.search}
                onChange={(e) => update({ search: e.target.value })}
                className="min-h-11 w-full rounded-xl border border-line bg-surface pr-3 pl-10 text-base text-ink placeholder:text-ink-muted/70 focus:border-brand focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              aria-label={refined ? 'Sort and filter (active)' : 'Sort and filter'}
              title="Sort and filter"
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-xl border',
                refined
                  ? 'border-brand bg-brand-soft text-brand-ink'
                  : 'border-line bg-surface text-ink hover:border-brand/60',
              )}
            >
              <SlidersHorizontal size={20} aria-hidden />
            </button>
          </div>

          <div
            role="radiogroup"
            aria-label="Filter by status"
            className="scrollbar-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
          >
            {STATUS_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                role="radio"
                aria-checked={query.status === chip.value}
                onClick={() => update({ status: chip.value })}
                className={cn(
                  'min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium',
                  query.status === chip.value
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-surface text-ink hover:border-brand/60',
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {results.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Nothing matches."
              action={
                isFiltered(query) && (
                  <Button
                    variant="secondary"
                    onClick={() => update({ search: '', status: 'all', category: 'all' })}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {results.map((sub) => (
                <SubscriptionCard
                  key={sub.id}
                  sub={sub}
                  today={today}
                  badges={badges.get(sub.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Sort and filter"
        footer={
          <>
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => update({ category: 'all', sort: DEFAULT_QUERY.sort })}
            >
              Reset
            </Button>
            <Button size="lg" className="flex-1" onClick={() => setFiltersOpen(false)}>
              Show {results.length}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Sort by"
            value={query.sort}
            onChange={(e) => update({ sort: e.target.value as SortKey })}
            options={SORTS}
          />
          <Select
            label="Category"
            value={query.category}
            onChange={(e) => update({ category: e.target.value as Category | 'all' })}
            options={[
              { value: 'all', label: 'All categories' },
              ...CATEGORIES.map((c) => ({ value: c, label: c })),
            ]}
          />
        </div>
      </Modal>{' '}
    </Screen>
  );
}
