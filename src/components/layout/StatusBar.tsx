import { useEffect, useState } from 'react';
import { BatteryFull, Signal, Wifi } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useIsDesktop } from '@/hooks/useViewport';
import { cn } from '@/lib/cn';
import { useClockStore, useToday } from '@/store/clockStore';
import { useDevice } from '@/store/deviceStore';

function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Fake phone status bar (desktop frame only), laid out around the phone's camera cutout. */
export function StatusBar() {
  const now = useMinuteTick();
  const today = useToday();
  const offset = useClockStore((s) => s.offsetDays);
  const device = useDevice();
  const desktop = useIsDesktop();
  if (!desktop) return null;

  const island = device.cutout === 'island';
  const time = format(now, 'H:mm');
  // When time-travelling, the date sits beside the time where there is room for it.
  const date = offset !== 0 ? format(parseISO(today), 'd MMM') : null;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between bg-canvas font-semibold text-ink',
        island ? 'px-9 pt-1 text-base' : device.homeButton ? 'px-3 text-xs' : 'px-6 text-sm',
      )}
      style={{ height: device.statusBar }}
    >
      <span className="flex items-baseline gap-2 whitespace-nowrap">
        {time}
        {date && !island && <span className="text-xs font-medium text-ink-muted">{date}</span>}
      </span>
      <span className="flex items-center gap-1.5" aria-hidden>
        <Signal size={island ? 17 : 15} />
        <Wifi size={island ? 17 : 15} />
        <BatteryFull size={island ? 22 : 18} />
      </span>
    </div>
  );
}
