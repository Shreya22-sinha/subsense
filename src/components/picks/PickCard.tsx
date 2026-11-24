import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { CancelSheet } from '@/components/subscriptions/CancelSheet';
import { Button } from '@/components/ui/Button';
import { ChoiceSheet } from '@/components/ui/ChoiceSheet';
import { getCatalogItem } from '@/data/catalog';
import { CYCLE_LABELS } from '@/engine/dates';
import { PICK_LABELS, type Pick } from '@/engine/recommendations';
import { cn } from '@/lib/cn';
import { formatDate, formatRs } from '@/lib/format';
import { DISMISS_REASONS } from '@/store/slices/pickSlice';
import { useDataStore } from '@/store/dataStore';
import { showToast } from '@/store/uiStore';
import type { DismissedPick } from '@/types/models';

type Sheet = 'none' | 'decide' | 'trim' | 'confirm' | 'cancel' | 'dismiss';

/**
 * A recommendation (PRD 6.11): type chip, title, "Why this?", saving or added cost, and
 * Accept / Not for me with equal size and weight. Accept opens the sheet the pick calls for.
 */
export function PickCard({ pick }: { pick: Pick }) {
  const navigate = useNavigate();
  const whyId = useId();
  const [whyOpen, setWhyOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>('none');
  const sub = useDataStore((s) => s.subscriptions.find((x) => x.id === pick.subId));
  const close = () => setSheet('none');
  const store = () => useDataStore.getState();

  const accept = () => {
    switch (pick.type) {
      case 'decide':
        return setSheet('decide');
      case 'trim':
        return setSheet('trim');
      case 'overlap':
        return setSheet('cancel');
      case 'discover': {
        store().markPickAccepted(pick);
        const params = new URLSearchParams({
          catalog: pick.catalogId ?? '',
          plan: pick.planName ?? '',
        });
        if (pick.newPricePaise !== undefined) params.set('price', String(pick.newPricePaise));
        return navigate(`/subs/new?${params}`);
      }
      default:
        return setSheet('confirm');
    }
  };

  const isSaving = pick.monthlySavingPaise > 0;
  const sameService = pick.catalogId && pick.catalogId === sub?.catalogId;
  const newItem = getCatalogItem(pick.catalogId);
  const oldCancelUrl = getCatalogItem(sub?.catalogId ?? null)?.cancelUrl;

  const confirmText = () => {
    if (!sub || pick.newPricePaise === undefined || !pick.newCycle) return '';
    const price = `${formatRs(pick.newPricePaise)} ${CYCLE_LABELS[pick.newCycle].name.toLowerCase()}`;
    if (pick.type === 'swap' && !sameService) {
      return `Cancel ${sub.name} on its official site first. We'll then mark it cancelled and add ${newItem?.name} ${pick.planName} (${price}) from ${sub.nextChargeDate ? formatDate(sub.nextChargeDate) : 'today'}.`;
    }
    if (pick.type === 'go_annual') {
      return `Switch ${sub.name} to the yearly plan on its official site. We'll update it to ${price} from your next renewal${sub.nextChargeDate ? ` on ${formatDate(sub.nextChargeDate)}` : ''}.`;
    }
    return `Change your plan on ${sub.name}'s official site, then confirm here. We'll update it to ${pick.planName} at ${price}.`;
  };

  return (
    <li className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-6 items-center rounded-full bg-brand-soft px-2.5 text-xs font-semibold text-brand-ink">
          {PICK_LABELS[pick.type]}
        </span>
        <span
          className={cn('text-base font-bold', isSaving ? 'text-success-ink' : 'text-ink-muted')}
        >
          {isSaving
            ? `Save ${formatRs(pick.monthlySavingPaise)}/mo`
            : `Adds ${formatRs(-pick.monthlySavingPaise)}/mo`}
        </span>
      </div>
      <h3 className="mt-3 text-lg leading-snug font-semibold text-ink">{pick.title}</h3>

      <button
        type="button"
        aria-expanded={whyOpen}
        aria-controls={whyId}
        onClick={() => setWhyOpen((o) => !o)}
        className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-ink"
      >
        Why this?
        <ChevronDown
          size={16}
          aria-hidden
          className={cn('transition-transform', whyOpen && 'rotate-180')}
        />
      </button>
      {whyOpen && (
        <p id={whyId} className="mb-3 text-base text-ink-muted">
          {pick.why}
        </p>
      )}

      {/* Equal size and weight (PRD 6.11, 10). */}
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={accept}>
          Accept
        </Button>
        <Button variant="secondary" onClick={() => setSheet('dismiss')}>
          Not for me
        </Button>
      </div>

      {/* Decide: keep or cancel the trial. */}
      <ChoiceSheet
        open={sheet === 'decide'}
        onClose={close}
        title={`Keep or cancel ${sub?.name ?? ''}?`}
        choices={[
          {
            label: 'Keep it',
            onSelect: () => {
              store().keepTrial(pick);
              showToast(`Keeping ${sub?.name}.`);
              close();
            },
          },
          { label: 'Cancel it', onSelect: () => setSheet('cancel') },
        ]}
      >
        {pick.why}
      </ChoiceSheet>

      {/* Trim: pause or cancel. */}
      <ChoiceSheet
        open={sheet === 'trim'}
        onClose={close}
        title={`Pause or cancel ${sub?.name ?? ''}?`}
        choices={[
          {
            label: 'Pause',
            onSelect: () => {
              store().pauseFromPick(pick);
              showToast(`${sub?.name} paused. It no longer counts towards your total.`);
              close();
            },
          },
          { label: 'Cancel', onSelect: () => setSheet('cancel') },
          { label: 'Not now', onSelect: close },
        ]}
      >
        Pausing stops it counting towards your total until you resume it. Cancelling stops it for
        good.
      </ChoiceSheet>

      {/* Student, Go annual, Swap: confirm. */}
      <ChoiceSheet
        open={sheet === 'confirm'}
        onClose={close}
        title={pick.title}
        choices={[
          { label: 'Not now', onSelect: close },
          {
            label: 'Confirm',
            onSelect: () => {
              if (pick.type === 'swap' && !sameService) store().applySwap(pick);
              else store().applyPlanChange(pick);
              showToast(`Done. You save ${formatRs(pick.monthlySavingPaise)}/month.`);
              close();
            },
          },
        ]}
      >
        <p>{confirmText()}</p>
        {pick.type === 'swap' && !sameService && oldCancelUrl && (
          <a
            href={oldCancelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-ink underline-offset-2 hover:underline"
          >
            How to cancel {sub?.name} <ExternalLink size={16} aria-hidden />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </ChoiceSheet>

      {sub && (
        <CancelSheet
          sub={sub}
          open={sheet === 'cancel'}
          onClose={close}
          onCancelled={() => store().markPickAccepted(pick)}
        />
      )}

      {/* Not for me: ask why. */}
      <ChoiceSheet
        open={sheet === 'dismiss'}
        onClose={close}
        title="Not for you?"
        choices={(Object.keys(DISMISS_REASONS) as DismissedPick['reason'][]).map((reason) => ({
          label: DISMISS_REASONS[reason],
          onSelect: () => {
            store().dismissPick(pick, reason);
            showToast("Got it. We won't suggest this for 30 days.");
            close();
          },
        }))}
      >
        Tell us why, and we'll hide this idea for 30 days.
      </ChoiceSheet>
    </li>
  );
}
