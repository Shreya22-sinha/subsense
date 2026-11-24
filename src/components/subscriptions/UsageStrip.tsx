import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { addDaysIso } from '@/engine/dates';
import { cn } from '@/lib/cn';
import type { IsoDate, Usage } from '@/types/models';

/** 30 dots, oldest left, today right; filled where "I used it" was tapped (PRD 6.8). */
export function UsageStrip({
  usages,
  subId,
  today,
}: {
  usages: Usage[];
  subId: string;
  today: IsoDate;
}) {
  const days = useMemo(() => {
    const used = new Set(usages.filter((u) => u.subId === subId).map((u) => u.date));
    return Array.from({ length: 30 }, (_, i) => {
      const date = addDaysIso(today, i - 29);
      return { date, used: used.has(date) };
    });
  }, [usages, subId, today]);

  return (
    <div>
      <ol className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-[3px]" aria-hidden>
        {days.map((d) => (
          <li
            key={d.date}
            title={`${format(parseISO(d.date), 'd MMM')}: ${d.used ? 'used' : 'not used'}`}
            className={cn('aspect-square rounded-full', d.used ? 'bg-brand' : 'bg-surface-2')}
          />
        ))}
      </ol>
      <div className="mt-1 flex justify-between text-[11px] text-ink-muted" aria-hidden>
        <span>{format(parseISO(days[0].date), 'd MMM')}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
