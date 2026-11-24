import { useMemo } from 'react';
import { PartyPopper } from 'lucide-react';
import { ActionCard } from '@/components/actions/ActionCard';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { ACTION_LEVELS, LEVEL_LABELS } from '@/engine/actions';
import { useActionItems } from '@/hooks/useDerived';

const LEVEL_HELP = {
  urgent: 'Free trials about to turn into charges.',
  review: 'Charges coming up for things you rarely use, or that just got pricier.',
  headsup: 'Big yearly charges in the next month.',
  ending: 'Plans that stop soon.',
  confirm: 'Recent charges to check against your bank.',
} as const;

/** Action Center (PRD 6.9): items grouped Urgent → Review → Heads-up → Ending → Confirm. */
export default function Actions() {
  const items = useActionItems();
  const groups = useMemo(
    () =>
      ACTION_LEVELS.map((level) => ({
        level,
        items: items.filter((i) => i.level === level),
      })).filter((g) => g.items.length > 0),
    [items],
  );

  return (
    <Screen title="Actions" back>
      {groups.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title="You're all caught up."
          body="Nothing needs a decision right now."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.level} aria-labelledby={`level-${g.level}`}>
              <h2 id={`level-${g.level}`} className="text-base font-semibold text-ink">
                {LEVEL_LABELS[g.level]} <span className="text-ink-muted">({g.items.length})</span>
              </h2>
              <p className="mb-2 text-xs text-ink-muted">{LEVEL_HELP[g.level]}</p>
              <ul className="flex flex-col gap-3">
                {g.items.map((item) => (
                  <ActionCard key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Screen>
  );
}
