import { useMemo, useState, type ReactNode } from 'react';
import { Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { ActivityTimeline } from '@/components/analytics/ActivityTimeline';
import { CategoryDonut } from '@/components/analytics/CategoryDonut';
import { MonthPicker } from '@/components/analytics/MonthPicker';
import { TrendBars } from '@/components/analytics/TrendBars';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { InitialCircle } from '@/components/ui/InitialCircle';
import { chartKey, type ChartKey } from '@/data/categories';
import {
  activitiesInMonth,
  breakdownDate,
  categoryBreakdown,
  costPerUseTop,
  dateOfTimestamp,
  decisionsInMonth,
  highlights,
  monthLabel,
  monthOf,
  monthSpend,
  savedInMonth,
  shiftMonth,
  spendTrend,
  totalSaved,
  type MonthKey,
  type TimelineFilter,
} from '@/engine/insights';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { cn } from '@/lib/cn';
import { formatRs } from '@/lib/format';
import { useToday } from '@/store/clockStore';
import { useDataStore } from '@/store/dataStore';

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 text-base font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

type View = 'overview' | 'spending' | 'activity';

/** Analytics (PRD 6.10, 7.9) in three views so each stays short. Lazy-loaded with its charts. */
export default function Analytics() {
  const today = useToday();
  const theme = useResolvedTheme();
  const subscriptions = useDataStore((s) => s.subscriptions);
  const charges = useDataStore((s) => s.charges);
  const savings = useDataStore((s) => s.savings);
  const usages = useDataStore((s) => s.usages);
  const activities = useDataStore((s) => s.activities);
  const budget = useDataStore((s) => s.profile.budgetPaise);

  const current = monthOf(today);
  const [view, setView] = useState<View>('overview');
  const [picked, setPicked] = useState<MonthKey | null>(null);
  const [filter, setFilter] = useState<TimelineFilter>('All');
  const [categoryFilter, setCategoryFilter] = useState<ChartKey | null>(null);

  // Earliest month with any record; never past the demo's current month.
  const minMonth = useMemo(() => {
    const dates = [...charges.map((c) => c.date), ...activities.map((a) => dateOfTimestamp(a.at))];
    return dates.length ? monthOf(dates.reduce((a, b) => (a < b ? a : b))) : current;
  }, [charges, activities, current]);
  const month = picked && picked <= current ? picked : current;
  const isCurrent = month === current;

  const data = useMemo(() => {
    const spend = monthSpend(month, charges, subscriptions, today);
    const prev = monthSpend(shiftMonth(month, -1), charges, subscriptions, today);
    return {
      spend,
      prevTotal: prev.spent + prev.projected,
      trend: spendTrend(month, charges, subscriptions, today),
      breakdown: categoryBreakdown(subscriptions, breakdownDate(month, today)),
      saved: savedInMonth(savings, month),
      totalSaved: totalSaved(savings, today),
      decisions: decisionsInMonth(activities, month),
      highlights: highlights(month, { subscriptions, charges, savings, usages }, today),
      costPerUse: costPerUseTop(subscriptions, usages, today),
      monthActivities: activitiesInMonth(activities, month),
    };
  }, [month, charges, subscriptions, savings, usages, activities, today]);

  const total = data.spend.spent + data.spend.projected;
  const change = total - data.prevTotal;
  const changePct = data.prevTotal > 0 ? Math.round((change / data.prevTotal) * 100) : null;
  const prevName = monthLabel(shiftMonth(month, -1)).split(' ')[0];

  const timelineActivities = useMemo(() => {
    if (!categoryFilter) return data.monthActivities;
    const ids = new Set(
      subscriptions.filter((s) => chartKey(s.category) === categoryFilter).map((s) => s.id),
    );
    return data.monthActivities.filter((a) => a.subId && ids.has(a.subId));
  }, [data.monthActivities, categoryFilter, subscriptions]);

  const committedPct = budget > 0 ? Math.round((data.spend.spent / budget) * 100) : 0;
  const withScheduledPct = budget > 0 ? Math.round((total / budget) * 100) : 0;

  return (
    <Screen title="Analytics">
      <div className="flex flex-col gap-6">
        <MonthPicker
          month={month}
          min={minMonth}
          max={current}
          onChange={(m) => {
            setPicked(m);
            setCategoryFilter(null);
          }}
        />

        <Segmented<View>
          label="Analytics view"
          value={view}
          onChange={setView}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'spending', label: 'Spending' },
            { value: 'activity', label: 'Activity' },
          ]}
        />

        {view === 'overview' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label={isCurrent ? 'Spent so far' : 'Spent'}
                value={formatRs(data.spend.spent)}
                sub={
                  isCurrent && data.spend.projected > 0
                    ? `+${formatRs(data.spend.projected)} scheduled`
                    : undefined
                }
              />
              <Stat
                label={`vs ${prevName}`}
                value={
                  changePct === null ? (
                    '—'
                  ) : (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1',
                        change > 0 ? 'text-danger-ink' : 'text-success-ink',
                      )}
                    >
                      {change > 0 ? (
                        <TrendingUp size={18} aria-hidden />
                      ) : (
                        <TrendingDown size={18} aria-hidden />
                      )}
                      {change > 0 ? '+' : '−'}
                      {formatRs(Math.abs(change))}
                    </span>
                  )
                }
                sub={
                  changePct === null
                    ? `No spend in ${prevName}`
                    : `${Math.abs(changePct)}% ${change > 0 ? 'more' : 'less'}${isCurrent ? ', incl. scheduled' : ''}`
                }
              />
              <Stat
                label="Saving each month"
                value={formatRs(data.saved)}
                sub={`${formatRs(data.totalSaved)} over full months so far`}
              />
              <Stat label="Decisions made" value={data.decisions} sub="Kept, paused or cancelled" />
            </div>

            {data.highlights.length > 0 && (
              <Card className="border-brand/30 bg-brand-soft">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                  <Sparkles size={16} className="text-brand-ink" aria-hidden /> Highlights
                </p>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
                  {data.highlights.map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ul>
              </Card>
            )}

            {isCurrent && (
              <Section title="Budget this month">
                <Card>
                  <p className="mb-2 text-sm text-ink">
                    <strong>{formatRs(data.spend.spent)}</strong> charged so far
                    {data.spend.projected > 0 && (
                      <> and {formatRs(data.spend.projected)} still scheduled</>
                    )}
                    , of a {formatRs(budget)} budget.
                  </p>
                  <div
                    role="img"
                    aria-label={`${committedPct}% of budget charged so far, ${withScheduledPct}% including scheduled charges`}
                    className="relative h-3 overflow-hidden rounded-full bg-surface-2"
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-brand/30"
                      style={{ width: `${Math.min(100, withScheduledPct)}%` }}
                    />
                    <div
                      className={cn(
                        'absolute inset-y-0 left-0 rounded-full',
                        committedPct > 100 ? 'bg-danger' : 'bg-brand',
                      )}
                      style={{ width: `${Math.min(100, committedPct)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-xs text-ink-muted">
                    <span>
                      {committedPct}% charged · {withScheduledPct}% with scheduled
                    </span>
                    <span>{formatRs(budget)}</span>
                  </div>
                </Card>
              </Section>
            )}
          </>
        )}

        {view === 'spending' && (
          <>
            <Section title="Spend by category">
              <Card>
                <CategoryDonut
                  breakdown={data.breakdown}
                  theme={theme}
                  selected={categoryFilter}
                  onSelect={setCategoryFilter}
                />
              </Card>
            </Section>

            {categoryFilter && (
              <Button
                variant="secondary"
                fullWidth
                className="-mt-3"
                onClick={() => setView('activity')}
              >
                See {categoryFilter === 'Other' ? 'bills and news' : categoryFilter} activity
              </Button>
            )}

            <Section title="Last 6 months">
              <Card>
                <TrendBars trend={data.trend} theme={theme} />
              </Card>
            </Section>

            {data.costPerUse.length > 0 && (
              <Section title="Cost per use">
                <Card className="py-1">
                  <ol className="divide-y divide-line">
                    {data.costPerUse.map(({ sub, costPaise }) => (
                      <li key={sub.id} className="flex items-center gap-3 py-2.5">
                        <InitialCircle name={sub.name} category={sub.category} size={32} />
                        <span className="flex-1 truncate text-sm font-medium text-ink">
                          {sub.name}
                        </span>
                        <span className="text-sm font-semibold text-ink">
                          {formatRs(costPaise)}
                        </span>
                        <span className="w-12 text-xs text-ink-muted">per use</span>
                      </li>
                    ))}
                  </ol>
                </Card>
                <p className="mt-1.5 text-xs text-ink-muted">
                  From your "I used it" taps over 30 days, or your usage rating for newer
                  subscriptions.
                </p>
              </Section>
            )}
          </>
        )}

        {view === 'activity' && (
          <Section title="Activity">
            {categoryFilter && (
              <p className="mb-2 text-sm text-ink-muted">
                Showing {categoryFilter === 'Other' ? 'bills and news' : categoryFilter} only.{' '}
                <button
                  type="button"
                  onClick={() => setCategoryFilter(null)}
                  className="min-h-11 font-semibold text-brand-ink underline-offset-2 hover:underline"
                >
                  Show all
                </button>
              </p>
            )}
            <ActivityTimeline
              activities={timelineActivities}
              filter={filter}
              onFilter={setFilter}
              emptyText="No activity in this month yet."
            />
          </Section>
        )}
      </div>
    </Screen>
  );
}
