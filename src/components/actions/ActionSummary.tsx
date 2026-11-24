import { Link } from 'react-router';
import { InitialCircle } from '@/components/ui/InitialCircle';
import type { ActionItem } from '@/engine/actions';
import { useDataStore } from '@/store/dataStore';
import { LevelBadge } from './ActionCard';

/**
 * Home's "Action needed" list: one calm row per item with its badge and reason. "Decide"
 * opens the Action Center, where every choice is shown with equal weight.
 */
export function ActionSummary({ items }: { items: ActionItem[] }) {
  const subscriptions = useDataStore((s) => s.subscriptions);
  return (
    <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
      {items.map((item) => {
        const sub = subscriptions.find((s) => s.id === item.subId);
        if (!sub) return null;
        return (
          <li key={item.id} className="flex items-center gap-3 p-4">
            <InitialCircle name={sub.name} category={sub.category} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-ink">{sub.name}</span>
                <LevelBadge level={item.level} />
              </div>
              <p className="mt-1 text-sm text-ink-muted">{item.reason}</p>
            </div>
            <Link
              to="/actions"
              aria-label={`Decide on ${sub.name}`}
              className="inline-flex min-h-11 shrink-0 items-center rounded-xl bg-brand-soft px-3.5 text-sm font-semibold text-brand-ink hover:bg-brand/20"
            >
              Decide
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
