import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CircleAlert, Lightbulb, X } from 'lucide-react';
import { Screen } from '@/components/layout/Screen';
import { PickCard } from '@/components/picks/PickCard';
import { CancelSheet } from '@/components/subscriptions/CancelSheet';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InitialCircle } from '@/components/ui/InitialCircle';
import { CATALOG } from '@/data/catalog';
import { FOR_YOU_LIMIT, isSavingsPick, potentialSavings } from '@/engine/recommendations';
import { couldHaveSaved } from '@/engine/vibeCheck';
import { usePicks } from '@/hooks/useDerived';
import { cn } from '@/lib/cn';
import { formatDate, formatRs } from '@/lib/format';
import { useToday } from '@/store/clockStore';
import { useDataStore } from '@/store/dataStore';
import { CATEGORIES, type Category, type Subscription } from '@/types/models';

type Tab = 'for_you' | 'save' | 'discover';
const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'for_you', label: 'For you' },
  { value: 'save', label: 'Save money' },
  { value: 'discover', label: 'Discover' },
];

/** Latest "last checked" date across the catalogue, or null if none are verified yet. */
const lastChecked = CATALOG.map((c) => c.lastVerified)
  .filter((d): d is string => !!d)
  .sort()
  .at(-1);

/** Recommendations (PRD 6.11). `?category=Video` narrows to one category. */
export default function Picks() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('for_you');
  const [cancelSub, setCancelSub] = useState<Subscription | null>(null);
  const { ranked, overBudget, headroomPaise } = usePicks();
  const subscriptions = useDataStore((s) => s.subscriptions);
  const charges = useDataStore((s) => s.charges);
  const usages = useDataStore((s) => s.usages);

  const rawCategory = params.get('category');
  const category = CATEGORIES.includes(rawCategory as Category) ? (rawCategory as Category) : null;

  const shown = useMemo(() => {
    const inCategory = category ? ranked.filter((p) => p.category === category) : ranked;
    if (tab === 'save') return inCategory.filter(isSavingsPick);
    if (tab === 'discover') return inCategory.filter((p) => !isSavingsPick(p));
    return inCategory.slice(0, FOR_YOU_LIMIT);
  }, [ranked, tab, category]);

  const missed = useMemo(
    () => couldHaveSaved(subscriptions, charges, usages, today),
    [subscriptions, charges, usages, today],
  );

  return (
    <Screen title="Recommendations" back={category ? true : undefined}>
      <div className="flex flex-col gap-6">
        <Card className="bg-brand-gradient border-0 text-white">
          <p className="text-sm text-white/85">Potential savings</p>
          <p className="font-display text-3xl font-bold">
            {formatRs(potentialSavings(shown))}/month
          </p>
          <p className="mt-1 text-sm text-white/90">
            Ideas based on your own data. Not financial advice.
          </p>
        </Card>

        {overBudget && (
          <div
            role="status"
            className="flex gap-3 rounded-[var(--radius-card)] border border-danger/40 bg-danger/8 p-3 text-sm text-ink"
          >
            <CircleAlert size={20} className="shrink-0 text-danger-ink" aria-hidden />
            <p>
              You're {formatRs(-headroomPaise)} over budget. New ideas are paused; savings first.
            </p>
          </div>
        )}

        {category && (
          <p className="flex items-center gap-2 text-sm text-ink-muted">
            Showing {category} ideas only.
            <button
              type="button"
              onClick={() => setParams({}, { replace: true })}
              className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand-ink"
            >
              <X size={14} aria-hidden /> Show all
            </button>
          </p>
        )}

        <div
          role="tablist"
          aria-label="Recommendation types"
          className="flex rounded-xl bg-surface-2 p-1"
        >
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'min-h-11 flex-1 rounded-lg text-sm font-medium',
                tab === t.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {shown.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              title={
                tab === 'discover' && overBudget ? 'New ideas are paused' : 'No ideas right now'
              }
              body={
                tab === 'discover'
                  ? overBudget
                    ? 'Get back under budget and new ideas will appear here.'
                    : 'Nothing new fits your interests and budget room right now.'
                  : "You're making good use of what you pay for. We'll suggest savings when we spot them."
              }
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {shown.map((p) => (
                <PickCard key={p.id} pick={p} />
              ))}
            </ul>
          )}
        </div>

        {missed.length > 0 && (
          <section aria-labelledby="missed">
            <h2 id="missed" className="mb-1 text-base font-semibold text-ink">
              What you could have saved
            </h2>
            <p className="mb-2 text-xs text-ink-muted">
              Money spent after you stopped using these much.
            </p>
            <ul className="flex flex-col gap-2">
              {missed.map((m) => {
                const live = m.sub.status === 'active' || m.sub.status === 'paused';
                return (
                  <li
                    key={m.sub.id}
                    className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4"
                  >
                    <InitialCircle name={m.sub.name} category={m.sub.category} size={36} />
                    <p className="flex-1 text-sm text-ink">{m.text}</p>
                    {live ? (
                      <Button
                        variant="secondary"
                        onClick={() => setCancelSub(m.sub)}
                        className="col-span-2"
                      >
                        Cancel it now
                      </Button>
                    ) : (
                      <ButtonLink
                        to={`/subs/${m.sub.id}`}
                        variant="secondary"
                        className="col-span-2"
                      >
                        View it
                      </ButtonLink>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p className="text-xs text-ink-muted">
          {lastChecked
            ? `Catalogue prices last checked on ${formatDate(lastChecked)}.`
            : 'Catalogue prices are typical and not yet checked against official sites.'}{' '}
          Prices may have changed; check the official site.
        </p>
      </div>

      {cancelSub && <CancelSheet sub={cancelSub} open onClose={() => setCancelSub(null)} />}
    </Screen>
  );
}
