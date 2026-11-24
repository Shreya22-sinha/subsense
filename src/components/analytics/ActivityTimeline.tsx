import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Ban,
  CalendarX,
  CircleDollarSign,
  Download,
  Hand,
  Lightbulb,
  Pencil,
  Plus,
  Scale,
  Trash2,
  TrendingUp,
  User,
  type LucideIcon,
} from 'lucide-react';
import { dateOfTimestamp, TIMELINE_FILTERS, type TimelineFilter } from '@/engine/insights';
import { cn } from '@/lib/cn';
import {
  ACTIVITY_GROUPS,
  type Activity,
  type ActivityGroup,
  type ActivityType,
} from '@/types/models';

const GROUP_ICON: Record<ActivityGroup, LucideIcon> = {
  Account: User,
  Added: Plus,
  Changed: Pencil,
  Billing: CircleDollarSign,
  Decisions: Scale,
  Usage: Hand,
  Recommendations: Lightbulb,
  Data: Download,
};

const TYPE_ICON: Partial<Record<ActivityType, LucideIcon>> = {
  price_changed: TrendingUp,
  subscription_deleted: Trash2,
  subscription_cancelled: Ban,
  subscription_ended: CalendarX,
};

function iconFor(type: ActivityType): LucideIcon {
  if (TYPE_ICON[type]) return TYPE_ICON[type];
  const group = (Object.keys(ACTIVITY_GROUPS) as ActivityGroup[]).find((g) =>
    (ACTIVITY_GROUPS[g] as readonly string[]).includes(type),
  );
  return group ? GROUP_ICON[group] : Pencil;
}

const FILTERS = Object.keys(TIMELINE_FILTERS) as TimelineFilter[];

/** Activity timeline (PRD 6.10): newest first, grouped by day, with filter chips. */
export function ActivityTimeline({
  activities,
  filter,
  onFilter,
  emptyText,
}: {
  activities: Activity[];
  filter: TimelineFilter;
  onFilter: (f: TimelineFilter) => void;
  emptyText: string;
}) {
  const days = useMemo(() => {
    const types = TIMELINE_FILTERS[filter] as readonly string[] | null;
    const shown = activities
      .filter((a) => !types || types.includes(a.type))
      .sort((a, b) => b.at.localeCompare(a.at));
    const groups = new Map<string, Activity[]>();
    for (const a of shown) {
      const d = dateOfTimestamp(a.at);
      groups.set(d, [...(groups.get(d) ?? []), a]);
    }
    return [...groups.entries()];
  }, [activities, filter]);

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Filter activity"
        className="scrollbar-thin -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={filter === f}
            onClick={() => onFilter(f)}
            className={cn(
              'min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium',
              filter === f
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-surface text-ink hover:border-brand/60',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {days.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {days.map(([day, items]) => (
            <section key={day} aria-label={format(parseISO(day), 'EEEE d MMMM')}>
              <h4 className="mb-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                {format(parseISO(day), 'EEE, d MMM')}
              </h4>
              <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
                {items.map((a) => {
                  const Icon = iconFor(a.type);
                  return (
                    <li key={a.id} className="flex items-start gap-3 px-3.5 py-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
                        <Icon size={16} aria-hidden />
                      </span>
                      <p className="flex-1 text-sm text-ink">{a.text}</p>
                      <time dateTime={a.at} className="shrink-0 text-xs text-ink-muted">
                        {format(parseISO(a.at), 'H:mm')}
                      </time>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
