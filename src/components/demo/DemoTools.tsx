import { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarDays, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/format';
import { useAuthStore, useIsDemo } from '@/store/authStore';
import { useClockStore, useToday } from '@/store/clockStore';
import { useDataStore } from '@/store/dataStore';
import { showToast } from '@/store/uiStore';

const WHAT_TO_TRY = [
  "Press +1 day three times: Netflix's trial converts and asks you to confirm.",
  'Tap "I used it" a few times and see the badges change.',
  'Raise a price in Edit to trigger the price-hike alert.',
  'Retake the quiz in More and compare your recommendations.',
];

/**
 * Demo controls (PRD 9.3): the desktop side panel and the mobile "Demo tools" section in
 * Settings both render this. Time travel and reset are for the demo account only: on a real
 * account they would record charges that never happened.
 */
export function DemoTools() {
  return useIsDemo() ? (
    <DemoOnlyTools />
  ) : (
    <div className="flex flex-col gap-5">
      <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-muted">
        Time travel and reset work in the demo account.
      </p>
      <LiveActivityLog />
    </div>
  );
}

function DemoOnlyTools() {
  const today = useToday();
  const offset = useClockStore((s) => s.offsetDays);
  const { advanceDays, advanceMonth, resetOffset } = useClockStore.getState();
  const resetDemo = useAuthStore((s) => s.resetDemo);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const offsetLabel = offset === 0 ? '' : ` (${offset > 0 ? '+' : ''}${offset} days)`;

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="demo-today">
        <h3
          id="demo-today"
          className="mb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase"
        >
          Today
        </h3>
        <p className="flex items-center gap-2 text-base font-semibold text-ink">
          <CalendarDays size={18} aria-hidden className="text-brand-ink" />
          {formatDate(today)}
          <span className="font-medium text-ink-muted">{offsetLabel}</span>
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button variant="secondary" className="px-1" onClick={() => advanceDays(1)}>
            +1 day
          </Button>
          <Button variant="secondary" className="px-1" onClick={() => advanceDays(7)}>
            +1 week
          </Button>
          <Button variant="secondary" className="px-1" onClick={() => advanceMonth()}>
            +1 month
          </Button>
        </div>
        <Button
          variant="ghost"
          fullWidth
          className="mt-2"
          disabled={offset === 0}
          onClick={resetOffset}
        >
          Back to today
        </Button>
      </section>

      <section aria-label="Reset demo">
        {confirmingReset ? (
          <div className="rounded-xl border border-line bg-surface-2 p-3 text-sm text-ink">
            <p className="mb-3">Rebuild the demo account and reset the clock to today?</p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                onClick={() => {
                  resetDemo();
                  setConfirmingReset(false);
                  showToast('Demo data reset.');
                }}
              >
                Reset
              </Button>
              <Button variant="secondary" onClick={() => setConfirmingReset(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" fullWidth onClick={() => setConfirmingReset(true)}>
            <RotateCcw size={16} aria-hidden />
            Reset demo data
          </Button>
        )}
      </section>

      <LiveActivityLog />

      <section aria-labelledby="demo-try">
        <h3
          id="demo-try"
          className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase"
        >
          What to try
        </h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-ink">
          {WHAT_TO_TRY.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function LiveActivityLog() {
  const signedIn = useAuthStore((s) => s.sessionUserId !== null);
  const activities = useDataStore((s) => s.activities);
  const latest = useMemo(
    () => [...activities].sort((a, b) => a.at.localeCompare(b.at)).slice(-20),
    [activities],
  );
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [latest]);

  return (
    <section aria-labelledby="demo-log">
      <h3
        id="demo-log"
        className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase"
      >
        Live activity log
      </h3>
      {!signedIn || latest.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {signedIn ? 'No activity yet.' : 'Sign in to see activity here.'}
        </p>
      ) : (
        <ol
          ref={listRef}
          className="scrollbar-thin flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-xl bg-surface-2 p-2 font-mono text-xs"
        >
          {latest.map((a) => (
            <li key={a.id} className="flex gap-2">
              <span className="shrink-0 text-ink-muted">
                {format(parseISO(a.at), 'd MMM H:mm')}
              </span>
              <span className="truncate text-ink" title={a.text}>
                {a.type}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
