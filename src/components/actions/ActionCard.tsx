import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlarmClock, CalendarClock, CalendarX, Eye, Receipt, type LucideIcon } from 'lucide-react';
import { CancelSheet } from '@/components/subscriptions/CancelSheet';
import { Button } from '@/components/ui/Button';
import { InitialCircle } from '@/components/ui/InitialCircle';
import { LEVEL_LABELS, type ActionItem, type ActionLevel } from '@/engine/actions';
import { cn } from '@/lib/cn';
import { useDataStore } from '@/store/dataStore';
import { showToast } from '@/store/uiStore';
import type { ActionDecision } from '@/store/slices/actionSlice';

const LEVEL_STYLE: Record<ActionLevel, { icon: LucideIcon; className: string }> = {
  urgent: { icon: AlarmClock, className: 'bg-danger/12 text-danger-ink' },
  review: { icon: Eye, className: 'bg-warning/20 text-warning-ink' },
  headsup: { icon: CalendarClock, className: 'bg-brand-soft text-brand-ink' },
  ending: { icon: CalendarX, className: 'bg-surface-2 text-ink-muted' },
  confirm: { icon: Receipt, className: 'bg-brand-2/15 text-brand-ink' },
};

export function LevelBadge({ level }: { level: ActionLevel }) {
  const { icon: Icon, className } = LEVEL_STYLE[level];
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold',
        className,
      )}
    >
      <Icon size={13} aria-hidden />
      {LEVEL_LABELS[level]}
    </span>
  );
}

interface ButtonSpec {
  label: string;
  run: () => void;
}

/**
 * One Action Center item (PRD 6.9, 7.6) with its 2–3 decisions and "Remind me tomorrow".
 * Decisions fade the card out before the store removes it.
 */
export function ActionCard({ item }: { item: ActionItem }) {
  const navigate = useNavigate();
  const sub = useDataStore((s) => s.subscriptions.find((x) => x.id === item.subId));
  const [leaving, setLeaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!sub) return null;

  /** Fade out, then apply the decision (which removes the item). */
  const leave = (fn: () => void) => {
    setLeaving(true);
    window.setTimeout(fn, 200);
  };
  const resolve = (decision: Exclude<ActionDecision, 'remind_tomorrow'>, toast?: string) =>
    leave(() => {
      useDataStore.getState().resolveAction(item, decision);
      if (toast) showToast(toast);
    });
  const seeOptions = () => navigate(`/picks?category=${encodeURIComponent(sub.category)}`);

  const buttons: Record<ActionLevel, ButtonSpec[]> = {
    urgent: [
      { label: 'Keep it', run: () => resolve('keep', `Keeping ${sub.name}.`) },
      { label: 'Cancel now', run: () => setCancelOpen(true) },
    ],
    review: [
      { label: 'Keep', run: () => resolve('keep', `Keeping ${sub.name}.`) },
      {
        label: 'Pause',
        run: () =>
          leave(() => {
            useDataStore.getState().pauseSubscription(sub.id);
            useDataStore.getState().resolveAction(item, 'pause');
            showToast(`${sub.name} paused.`);
          }),
      },
      { label: 'Cancel', run: () => setCancelOpen(true) },
    ],
    headsup: [
      { label: 'Still worth it', run: () => resolve('still_worth_it') },
      { label: 'See options', run: seeOptions },
    ],
    ending: [
      {
        label: 'Renew',
        run: () => {
          useDataStore.getState().resolveAction(item, 'renew');
          showToast('Set a new end date, or clear it and turn on auto-renew.');
          navigate(`/subs/${sub.id}/edit`);
        },
      },
      { label: 'Let it end', run: () => resolve('let_it_end') },
      { label: 'Switch', run: seeOptions },
    ],
    confirm: [
      { label: 'Yes, paid', run: () => resolve('confirmed_paid') },
      {
        label: "No, I'd cancelled",
        run: () =>
          leave(() => {
            useDataStore.getState().rejectCharge(item);
            showToast(`Removed the charge and marked ${sub.name} as cancelled.`);
          }),
      },
    ],
  };

  const specs = buttons[item.level];

  return (
    <li
      className={cn(
        'rounded-[var(--radius-card)] border border-line bg-surface p-4 transition-all duration-200',
        leaving && 'translate-x-4 opacity-0',
      )}
    >
      <div className="flex items-center gap-3">
        <InitialCircle name={sub.name} category={sub.category} />
        <Link
          to={`/subs/${sub.id}`}
          className="min-w-0 flex-1 text-base font-semibold text-ink underline-offset-2 hover:underline"
        >
          {sub.name}
        </Link>
        <LevelBadge level={item.level} />
      </div>
      <p className="mt-3 text-base text-ink">{item.reason}</p>

      {/* Equal-weight buttons: declining is as easy as accepting (PRD 10). */}
      <div className={cn('mt-4 grid gap-2', specs.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
        {specs.map((b) => (
          <Button
            key={b.label}
            variant="secondary"
            onClick={b.run}
            disabled={leaving}
            className="px-2"
          >
            {b.label}
          </Button>
        ))}
      </div>
      <button
        type="button"
        disabled={leaving}
        onClick={() =>
          leave(() => {
            useDataStore.getState().snoozeAction(item);
            showToast("We'll remind you tomorrow.");
          })
        }
        className="mt-2 -mb-2 min-h-11 w-full text-sm font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
      >
        Remind me tomorrow
      </button>

      <CancelSheet
        sub={sub}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onCancelled={() => useDataStore.getState().resolveAction(item, 'cancel')}
      />
    </li>
  );
}
