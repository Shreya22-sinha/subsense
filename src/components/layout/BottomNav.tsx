import { NavLink } from 'react-router';
import { ChartPie, House, Layers, Lightbulb, Menu, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

const TABS: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: '/home', label: 'Home', icon: House },
  { to: '/subs', label: 'Subscriptions', icon: Layers },
  { to: '/picks', label: 'Recommendations', icon: Lightbulb },
  { to: '/analytics', label: 'Analytics', icon: ChartPie },
  { to: '/settings', label: 'More', icon: Menu },
];

/** 5-tab bottom bar. Tabs size to their label so "Recommendations" fits on small phones. */
export function BottomNav() {
  return (
    <nav
      aria-label="Main"
      className="shrink-0 border-t border-line bg-surface pb-[var(--safe-bottom)]"
    >
      <ul className="flex">
        {TABS.map(({ to, label, icon: Icon }) => (
          <li key={to} className="min-w-11 flex-auto">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[60px] flex-col items-center justify-center gap-1 px-0.5 text-[11px] font-semibold',
                  isActive ? 'text-brand-ink' : 'text-ink-muted hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-7 w-12 items-center justify-center rounded-full',
                      isActive && 'bg-brand-soft',
                    )}
                  >
                    <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} aria-hidden />
                  </span>
                  <span className="whitespace-nowrap">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
