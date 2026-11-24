import { useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { format, parseISO } from 'date-fns';
import { Ban, Check, ExternalLink, Pause, Pencil, Play, SearchX, Trash2 } from 'lucide-react';
import { Screen } from '@/components/layout/Screen';
import { VibeCheckCard } from '@/components/picks/VibeCheckCard';
import { BadgeChip } from '@/components/subscriptions/BadgeChip';
import { CancelSheet } from '@/components/subscriptions/CancelSheet';
import { PriceHikeBanner, type PriceHikeState } from '@/components/subscriptions/PriceHikeBanner';
import { UsageStrip } from '@/components/subscriptions/UsageStrip';
import { UsedItButton } from '@/components/subscriptions/UsedItButton';
import { StatusPill } from '@/components/subscriptions/StatusPill';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Disclosure } from '@/components/ui/Disclosure';
import { EmptyState } from '@/components/ui/EmptyState';
import { InitialCircle } from '@/components/ui/InitialCircle';
import { getCatalogItem } from '@/data/catalog';
import { monthlyShareOf, relativeDayLabel, sharePaise } from '@/engine/dates';
import { costPerUsePaise, usageSummary, uses30 } from '@/engine/usage';
import { isVibeCheckDue } from '@/engine/vibeCheck';
import { useBadges } from '@/hooks/useDerived';
import { useSubscriptionActions } from '@/hooks/useSubscriptionActions';
import { formatDate, formatRs } from '@/lib/format';
import { priceAndCycle } from '@/lib/subscriptionDisplay';
import { useToday } from '@/store/clockStore';
import { useDataStore } from '@/store/dataStore';
import { showToast } from '@/store/uiStore';

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>
  );
}

/**
 * Subscription detail (PRD 6.8): header with badges, price-hike banner (7.5), key facts,
 * spent so far, usage, vibe check when due (7.8), actions, history and price history.
 */
export default function SubscriptionDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const today = useToday();
  const sub = useDataStore((s) => s.subscriptions.find((x) => x.id === id));
  const allCharges = useDataStore((s) => s.charges);
  const allActivities = useDataStore((s) => s.activities);
  const allPriceChanges = useDataStore((s) => s.priceChanges);
  const usages = useDataStore((s) => s.usages);
  const badges = useBadges().get(id) ?? [];
  const location = useLocation();
  const [hikeState, setHikeState] = useState<PriceHikeState | null>(
    (location.state as { priceHike?: PriceHikeState } | null)?.priceHike ?? null,
  );
  const { deleteWithUndo, pause, resume } = useSubscriptionActions();
  const [cancelOpen, setCancelOpen] = useState(false);
  // Keep the vibe check on screen after answering so its follow-up stays visible.
  const [vibeAnswered, setVibeAnswered] = useState(false);

  const charges = useMemo(() => allCharges.filter((c) => c.subId === id), [allCharges, id]);
  const history = useMemo(
    () => allActivities.filter((a) => a.subId === id).sort((a, b) => b.at.localeCompare(a.at)),
    [allActivities, id],
  );
  const priceChanges = useMemo(
    () =>
      allPriceChanges.filter((p) => p.subId === id).sort((a, b) => b.date.localeCompare(a.date)),
    [allPriceChanges, id],
  );

  if (!sub) {
    return (
      <Screen title="Subscription" back="/subs">
        <EmptyState
          icon={SearchX}
          title="Subscription not found"
          body="It may have been deleted."
          action={<ButtonLink to="/subs">Back to subscriptions</ButtonLink>}
        />
      </Screen>
    );
  }

  const catalog = getCatalogItem(sub.catalogId);
  const spent = charges.reduce((sum, c) => sum + c.amountPaise, 0);
  const isLive = sub.status === 'active' || sub.status === 'paused';

  return (
    <Screen title="Subscription" back>
      <div className="flex flex-col gap-5">
        <header className="flex items-center gap-4">
          <InitialCircle name={sub.name} category={sub.category} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl leading-tight font-bold text-ink">{sub.name}</h2>
            <p className="text-sm text-ink-muted">
              {[sub.planName, sub.category].filter(Boolean).join(' · ')}
            </p>
            <div className="mt-1">
              <StatusPill sub={sub} />
            </div>
          </div>
        </header>

        {badges.length > 0 && (
          <div className="-mt-2 flex flex-wrap gap-2" aria-label="Badges">
            {badges.map((b) => (
              <BadgeChip key={b.kind} badge={b} />
            ))}
          </div>
        )}

        {hikeState && (
          <PriceHikeBanner
            sub={sub}
            state={hikeState}
            onClose={() => {
              setHikeState(null);
              // Drop the router state so a reload doesn't show the banner again.
              navigate('.', { replace: true, state: null });
            }}
          />
        )}

        <Card className="py-1">
          <dl className="divide-y divide-line">
            <Fact label="Price">{priceAndCycle(sub)}</Fact>
            {sub.cycle !== 'monthly' && sub.cycle !== 'one_time' && (
              <Fact label="Monthly equivalent">
                {formatRs(monthlyShareOf({ ...sub, sharedWith: 1 }))}
              </Fact>
            )}
            {sub.sharedWith > 1 && (
              <Fact label="Your share">
                {formatRs(sharePaise(sub.pricePaise, sub.sharedWith))} (
                {formatRs(monthlyShareOf(sub))}
                /month, shared by {sub.sharedWith})
              </Fact>
            )}
            {sub.status === 'active' && sub.nextChargeDate && (
              <Fact label={sub.isTrial ? 'First charge' : 'Next charge'}>
                {formatDate(sub.nextChargeDate)} · {relativeDayLabel(sub.nextChargeDate, today)}
              </Fact>
            )}
            {sub.isTrial && sub.trialEndDate && (
              <Fact label="Trial ends">{formatDate(sub.trialEndDate)}</Fact>
            )}
          </dl>
        </Card>

        <Card>
          <p className="text-sm text-ink-muted">Spent so far</p>
          <p className="font-display text-3xl font-bold text-ink">{formatRs(spent)}</p>
          <p className="text-xs text-ink-muted">
            {charges.length === 0
              ? 'No payments recorded yet.'
              : `Across ${charges.length} ${charges.length === 1 ? 'payment' : 'payments'} since ${formatDate(sub.startDate)}.`}
          </p>
        </Card>

        <Card>
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Usage</p>
              <p className="text-sm text-ink-muted">
                {usageSummary(sub, uses30(usages, sub.id, today), today)}
              </p>
              {sub.status === 'active' && monthlyShareOf(sub) > 0 && (
                <p className="text-xs text-ink-muted">
                  About {formatRs(costPerUsePaise(sub, uses30(usages, sub.id, today), today))} per
                  use
                </p>
              )}
            </div>
            <UsedItButton sub={sub} />
          </div>
          <UsageStrip usages={usages} subId={sub.id} today={today} />
        </Card>

        {(vibeAnswered || isVibeCheckDue(sub, today)) && (
          <VibeCheckCard sub={sub} onAnswered={() => setVibeAnswered(true)} />
        )}

        {sub.notes && (
          <Card>
            <p className="mb-1 text-sm font-semibold text-ink">Notes</p>
            <p className="text-sm whitespace-pre-wrap text-ink-muted">{sub.notes}</p>
          </Card>
        )}

        {isLive && (
          <section aria-label="Decide" className="grid auto-cols-fr grid-flow-col gap-2">
            {sub.status === 'active' ? (
              <>
                <Button
                  variant="secondary"
                  className="px-2"
                  onClick={() => {
                    useDataStore.getState().keepSubscription(sub.id);
                    showToast(`Noted. You're keeping ${sub.name}.`);
                  }}
                >
                  <Check size={18} aria-hidden /> Keep
                </Button>
                <Button variant="secondary" className="px-2" onClick={() => pause(sub.id)}>
                  <Pause size={18} aria-hidden /> Pause
                </Button>
              </>
            ) : (
              <Button variant="secondary" className="px-2" onClick={() => resume(sub.id)}>
                <Play size={18} aria-hidden /> Resume
              </Button>
            )}
            <Button variant="secondary" className="px-2" onClick={() => setCancelOpen(true)}>
              <Ban size={18} aria-hidden /> Cancel
            </Button>
          </section>
        )}

        <Disclosure title="More details" hint="Dates, payment and reminders">
          <dl className="divide-y divide-line">
            <Fact label="Started">{formatDate(sub.startDate)}</Fact>
            {sub.endDate && <Fact label="Ends">{formatDate(sub.endDate)}</Fact>}
            {sub.cancelledAt && <Fact label="Cancelled">{formatDate(sub.cancelledAt)}</Fact>}
            {sub.paidWith && <Fact label="Paid with">{sub.paidWith}</Fact>}
            <Fact label="Auto-renew">{sub.autoRenew ? 'On' : 'Off'}</Fact>
            <Fact label="Reminder">
              {sub.reminderDays} {sub.reminderDays === 1 ? 'day' : 'days'} before
            </Fact>
          </dl>
        </Disclosure>
        {priceChanges.length > 0 && (
          <Disclosure
            title="Price history"
            hint={`${priceChanges.length} change${priceChanges.length === 1 ? '' : 's'}`}
          >
            <ul className="divide-y divide-line text-sm">
              {priceChanges.map((p) => (
                <li key={p.id} className="flex justify-between py-2.5">
                  <span className="text-ink-muted">{formatDate(p.date)}</span>
                  <span className="font-medium text-ink">
                    {formatRs(p.oldPaise)} → {formatRs(p.newPaise)}
                  </span>
                </li>
              ))}
            </ul>
          </Disclosure>
        )}

        <Disclosure
          title="History"
          hint={history.length === 1 ? '1 event' : `${history.length} events`}
        >
          {history.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing yet.</p>
          ) : (
            <ol className="flex flex-col gap-4 border-l-2 border-line pl-4">
              {history.map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="text-ink">{a.text}</p>
                  <p className="text-xs text-ink-muted">
                    {format(parseISO(a.at), 'd MMM yyyy, H:mm')}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Disclosure>
        {catalog?.officialUrl && (
          <a
            href={catalog.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-brand-ink underline-offset-2 hover:underline"
          >
            Official {sub.name} site <ExternalLink size={14} aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}

        <div className="grid grid-cols-2 gap-2">
          <ButtonLink to={`/subs/${sub.id}/edit`} variant="secondary">
            <Pencil size={18} aria-hidden /> Edit
          </ButtonLink>
          <Button
            variant="danger"
            onClick={() => {
              deleteWithUndo(sub.id);
              navigate('/subs', { replace: true });
            }}
          >
            <Trash2 size={18} aria-hidden /> Delete
          </Button>
        </div>
      </div>
      <CancelSheet sub={sub} open={cancelOpen} onClose={() => setCancelOpen(false)} />{' '}
    </Screen>
  );
}
