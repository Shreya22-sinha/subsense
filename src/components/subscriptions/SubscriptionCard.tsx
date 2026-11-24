import { Link, useNavigate } from 'react-router';
import { Pause, Pencil, Play, Trash2 } from 'lucide-react';
import { InitialCircle } from '@/components/ui/InitialCircle';
import { Menu, type MenuItem } from '@/components/ui/Menu';
import { MAX_CARD_BADGES, type Badge } from '@/engine/badges';
import { CYCLE_LABELS, monthlyShareOf, sharePaise } from '@/engine/dates';
import { useSubscriptionActions } from '@/hooks/useSubscriptionActions';
import { formatRs } from '@/lib/format';
import { chargeLine } from '@/lib/subscriptionDisplay';
import type { IsoDate, Subscription } from '@/types/models';
import { BadgeChip } from './BadgeChip';
import { UsedItButton } from './UsedItButton';

/**
 * Subscription card (PRD 6.6): initial, name and plan, category, monthly price (and the real
 * price if not monthly), next charge, up to 2 badges and "I used it". The card links to the
 * detail page (stretched link); the menu, badges and button sit above the link.
 */
export function SubscriptionCard({
  sub,
  today,
  badges = [],
}: {
  sub: Subscription;
  today: IsoDate;
  badges?: Badge[];
}) {
  const navigate = useNavigate();
  const { deleteWithUndo, pause, resume } = useSubscriptionActions();
  const inactive = sub.status !== 'active';
  const share = sharePaise(sub.pricePaise, sub.sharedWith);
  const shown = badges.slice(0, MAX_CARD_BADGES);

  const items: MenuItem[] = [
    { label: 'Edit', icon: Pencil, onSelect: () => navigate(`/subs/${sub.id}/edit`) },
    ...(sub.status === 'active'
      ? [{ label: 'Pause', icon: Pause, onSelect: () => pause(sub.id) }]
      : sub.status === 'paused'
        ? [{ label: 'Resume', icon: Play, onSelect: () => resume(sub.id) }]
        : []),
    { label: 'Delete', icon: Trash2, onSelect: () => deleteWithUndo(sub.id), danger: true },
  ];

  return (
    <li className="relative rounded-[var(--radius-card)] border border-line bg-surface hover:border-brand/40">
      <div className="flex items-start gap-3 py-4 pr-1 pl-4">
        <span className={inactive ? 'opacity-60' : undefined}>
          <InitialCircle name={sub.name} category={sub.category} size={44} />
        </span>
        <div className="min-w-0 flex-1">
          <Link
            to={`/subs/${sub.id}`}
            className="block text-base leading-snug font-semibold text-ink after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus:outline-none focus-visible:after:outline-2 focus-visible:after:outline-brand"
          >
            {sub.name}
          </Link>
          <p className="text-sm text-ink-muted">
            {[sub.planName, sub.category].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base leading-snug font-semibold text-ink">
            {sub.cycle === 'one_time' ? formatRs(share) : `${formatRs(monthlyShareOf(sub))}/mo`}
          </p>
          {sub.cycle !== 'monthly' && sub.cycle !== 'one_time' && (
            <p className="text-xs text-ink-muted">
              {formatRs(share)}/{CYCLE_LABELS[sub.cycle].short}
            </p>
          )}
          {sub.sharedWith > 1 && <p className="text-xs text-ink-muted">your share</p>}
        </div>
        <div className="relative z-10 -mt-2.5 -ml-2">
          <Menu label={`More actions for ${sub.name}`} items={items} />
        </div>
      </div>

      {shown.length > 0 && (
        <div className="relative z-10 -mt-1 flex flex-wrap gap-2 px-4 pb-3.5">
          {shown.map((b) => (
            <BadgeChip key={b.kind} badge={b} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-line py-2 pr-3 pl-4">
        <p className="text-sm font-medium text-ink">{chargeLine(sub, today)}</p>
        <div className="relative z-10">
          <UsedItButton sub={sub} />
        </div>
      </div>
    </li>
  );
}
