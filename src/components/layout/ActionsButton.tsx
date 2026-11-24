import { NavLink } from 'react-router';
import { ListChecks } from 'lucide-react';
import { actionBadgeCount } from '@/engine/actions';
import { useActionItems } from '@/hooks/useDerived';
import { cn } from '@/lib/cn';

/** Top-right link to the Action Center, with the count of Urgent plus Review items. */
export function ActionsButton() {
  const count = actionBadgeCount(useActionItems());
  return (
    <NavLink
      to="/actions"
      aria-label={count > 0 ? `Actions, ${count} need a decision` : 'Actions'}
      title="Actions"
      className={({ isActive }) =>
        cn(
          'relative flex size-11 items-center justify-center rounded-full',
          isActive ? 'bg-brand-soft text-brand-ink' : 'text-ink hover:bg-surface-2',
        )
      }
    >
      <ListChecks size={24} aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute top-0.5 right-0 flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-canvas bg-[#C4262C] px-1 text-[11px] leading-none font-bold text-white"
        >
          {count}
        </span>
      )}
    </NavLink>
  );
}
