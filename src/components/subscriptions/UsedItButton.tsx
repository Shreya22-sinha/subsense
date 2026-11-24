import { Check, Hand } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToday } from '@/store/clockStore';
import { useDataStore } from '@/store/dataStore';
import { showToast } from '@/store/uiStore';
import type { Subscription } from '@/types/models';

/**
 * "I used it" (PRD 7.4): one tap logs a use for today, with Undo for 5 seconds.
 * Shows a check mark until the next (demo) day.
 */
export function UsedItButton({ sub, size = 'sm' }: { sub: Subscription; size?: 'sm' | 'lg' }) {
  const today = useToday();
  const usedToday = useDataStore((s) =>
    s.usages.some((u) => u.subId === sub.id && u.date === today),
  );

  if (sub.status !== 'active') return null;

  const onClick = () => {
    const store = useDataStore.getState();
    const result = store.logUsage(sub.id);
    if (result.status === 'already') {
      showToast('Already logged for today');
    } else if (result.status === 'logged') {
      showToast(`Logged a use of ${sub.name}`, {
        durationMs: 5000,
        action: {
          label: 'Undo',
          onClick: () => useDataStore.getState().undoUsage(result.usageId, result.activityId),
        },
      });
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={usedToday}
      aria-label={usedToday ? `${sub.name}: use logged for today` : `I used ${sub.name} today`}
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border font-semibold transition-colors',
        size === 'sm' ? 'px-3 text-xs' : 'w-full px-4 text-sm',
        usedToday
          ? 'border-success/40 bg-success/12 text-success-ink'
          : 'border-line bg-surface text-ink hover:border-brand/60',
      )}
    >
      {usedToday ? <Check size={16} aria-hidden /> : <Hand size={16} aria-hidden />}
      {usedToday ? 'Used today' : 'I used it'}
    </button>
  );
}
