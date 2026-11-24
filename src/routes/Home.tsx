import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { format, parseISO } from 'date-fns';
import { CalendarCheck, Wallet } from 'lucide-react';
import { ActionSummary } from '@/components/actions/ActionSummary';
import { BudgetMeter } from '@/components/BudgetMeter';
import { AddButton } from '@/components/layout/AddButton';
import { Screen } from '@/components/layout/Screen';
import { PickCard } from '@/components/picks/PickCard';
import { VibeCheckCard } from '@/components/picks/VibeCheckCard';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InitialCircle } from '@/components/ui/InitialCircle';
import { monthlyTotalPaise, relativeDayLabel } from '@/engine/dates';
import { upcomingCharges } from '@/engine/insights';
import { FOR_YOU_LIMIT, potentialSavings } from '@/engine/recommendations';
import { homeVibeCheck } from '@/engine/vibeCheck';
import { useActionItems, usePicks } from '@/hooks/useDerived';
import { firstName, formatLongDay, formatRs } from '@/lib/format';
import { useCurrentUser } from '@/store/authStore';
import { useToday } from '@/store/clockStore';
import { useDataStore } from '@/store/dataStore';

function SectionHeader({
  id,
  title,
  link,
}: {
  id: string;
  title: string;
  link?: { to: string; label: string };
}) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h3 id={id} className="text-base font-semibold text-ink">
        {title}
      </h3>
      {link && (
        <Link
          to={link.to}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-ink underline-offset-2 hover:underline"
        >
          {link.label}
        </Link>
      )}
    </div>
  );
}

/**
 * Home (PRD 6.5), top to bottom: greeting with the demo date, monthly total, budget meter,
 * top recommendation, Action needed (top 3), Coming up (next 7 days) and the day's vibe check.
 * Recommendations lead, and + sits in the top bar so it never covers other buttons.
 */
export default function Home() {
  const user = useCurrentUser();
  const today = useToday();
  const subscriptions = useDataStore((s) => s.subscriptions);
  const budget = useDataStore((s) => s.profile.budgetPaise);
  const actionItems = useActionItems();
  const { ranked } = usePicks();
  // Keep an answered vibe check on screen so its follow-up stays visible.
  const [vibeId, setVibeId] = useState<string | null>(null);

  const active = useMemo(() => subscriptions.filter((s) => s.status === 'active'), [subscriptions]);
  const total = monthlyTotalPaise(subscriptions);
  const unconfirmed = active.filter((s) => !s.datesConfirmed);
  const upcoming = useMemo(() => upcomingCharges(subscriptions, today), [subscriptions, today]);
  const vibeSub =
    (vibeId && subscriptions.find((s) => s.id === vibeId)) || homeVibeCheck(subscriptions, today);
  // Lead with an idea that isn't already listed under Action needed.
  const shownActions = actionItems.slice(0, 3);
  const actionSubs = new Set(shownActions.map((i) => i.subId));
  const topPick = ranked.find((p) => !p.subId || !actionSubs.has(p.subId)) ?? ranked[0];
  const couldSave = potentialSavings(ranked.slice(0, FOR_YOU_LIMIT)); // same as the For you tab
  const subById = (id: string) => subscriptions.find((s) => s.id === id);

  return (
    <Screen title="Home" actions={<AddButton />}>
      <p className="text-sm text-ink-muted">{formatLongDay(today)}</p>
      <h2 className="mb-4 text-2xl font-bold text-ink">Hi {firstName(user?.name ?? 'there')}</h2>

      {active.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title="Add your first subscription to see your real monthly total"
            action={<ButtonLink to="/subs/new">Add subscription</ButtonLink>}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-7 pb-4">
          <Card className="bg-brand-gradient border-0 p-5 text-white">
            <p className="text-sm text-white/85">You pay each month</p>
            <p className="font-display text-4xl font-bold">{formatRs(total)}</p>
            <p className="mt-1 text-sm text-white/90">
              {formatRs(total * 12)} per year · {active.length} active
            </p>
          </Card>

          <Card className="-mt-3">
            <BudgetMeter totalPaise={total} budgetPaise={budget} />
          </Card>

          {unconfirmed.length > 0 && (
            <Card className="flex gap-3 border-brand/40 bg-brand-soft">
              <CalendarCheck size={22} className="mt-0.5 shrink-0 text-brand-ink" aria-hidden />
              <div className="text-sm">
                <p className="font-semibold text-ink">Confirm your dates</p>
                <p className="text-ink-muted">
                  These were added with typical prices and today as the start date. Check each plan
                  and billing date so reminders are right.
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {unconfirmed.map((s) => (
                    <li key={s.id}>
                      <Link
                        to={`/subs/${s.id}/edit`}
                        className="inline-flex min-h-11 items-center rounded-full border border-brand/40 bg-surface px-3.5 font-semibold text-brand-ink hover:bg-brand-soft"
                      >
                        Check {s.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}

          {topPick && (
            <section aria-labelledby="home-pick">
              <SectionHeader
                id="home-pick"
                title="Recommended for you"
                link={{ to: '/picks', label: `See all (${ranked.length})` }}
              />
              {couldSave > 0 && (
                <p className="-mt-1 mb-3 text-sm text-ink-muted">
                  You could save up to{' '}
                  <strong className="text-success-ink">{formatRs(couldSave)} a month</strong>.
                </p>
              )}
              <ul>
                <PickCard key={topPick.id} pick={topPick} />
              </ul>
            </section>
          )}

          {shownActions.length > 0 && (
            <section aria-labelledby="home-actions">
              <SectionHeader
                id="home-actions"
                title="Action needed"
                link={{ to: '/actions', label: `See all (${actionItems.length})` }}
              />
              <ActionSummary items={shownActions} />
            </section>
          )}
          <section aria-labelledby="home-upcoming">
            <SectionHeader id="home-upcoming" title="Coming up" />
            {upcoming.length === 0 ? (
              <p className="text-sm text-ink-muted">No charges in the next 7 days.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
                {upcoming.map((c) => {
                  const s = subById(c.subId);
                  if (!s) return null;
                  return (
                    <li
                      key={`${c.subId}-${c.date}`}
                      className="relative flex items-center gap-3 px-4 py-3"
                    >
                      <InitialCircle name={s.name} category={s.category} size={36} />
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/subs/${s.id}`}
                          className="block truncate font-semibold text-ink after:absolute after:inset-0 focus:outline-none focus-visible:after:outline-2 focus-visible:after:outline-brand"
                        >
                          {s.name}
                        </Link>
                        <p className="text-xs text-ink-muted">
                          {format(parseISO(c.date), 'EEE, d MMM')} ·{' '}
                          {relativeDayLabel(c.date, today)}
                          {s.isTrial && c.date === s.trialEndDate ? ' · trial ends' : ''}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-ink">{formatRs(c.amountPaise)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {vibeSub && (
            <VibeCheckCard
              key={vibeSub.id}
              sub={vibeSub}
              onAnswered={() => setVibeId(vibeSub.id)}
            />
          )}
        </div>
      )}
    </Screen>
  );
}
