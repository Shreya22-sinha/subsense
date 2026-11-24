/**
 * Demo clock (PRD 4 and 9.3). "Today" = real date + offsetDays.
 * Components get today via useToday(); store actions via getToday()/getNowIso().
 * Never call `new Date()` for "today" anywhere else.
 */
import { addDays, addMonths, differenceInCalendarDays } from 'date-fns';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { toIsoDate } from '@/engine/dates';
import { STORAGE_KEYS } from '@/lib/storageKeys';
import type { IsoDate, IsoTimestamp } from '@/types/models';

const DAY_MS = 86_400_000;

interface ClockState {
  offsetDays: number;
  advanceDays: (days: number) => void;
  advanceMonth: () => void;
  resetOffset: () => void;
}

export const useClockStore = create<ClockState>()(
  persist(
    (set, get) => ({
      offsetDays: 0,
      advanceDays: (days) => set({ offsetDays: get().offsetDays + days }),
      advanceMonth: () => {
        // +1 calendar month from the current demo day.
        const current = addDays(new Date(), get().offsetDays);
        const delta = differenceInCalendarDays(addMonths(current, 1), current);
        set({ offsetDays: get().offsetDays + delta });
      },
      resetOffset: () => set({ offsetDays: 0 }),
    }),
    {
      name: STORAGE_KEYS.clock,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ offsetDays: s.offsetDays }),
    },
  ),
);

export function todayForOffset(offsetDays: number): IsoDate {
  return toIsoDate(addDays(new Date(), offsetDays));
}

export function getToday(): IsoDate {
  return todayForOffset(useClockStore.getState().offsetDays);
}

/** Current timestamp in demo time (real time of day, shifted by the offset). */
export function getNowIso(): IsoTimestamp {
  return new Date(Date.now() + useClockStore.getState().offsetDays * DAY_MS).toISOString();
}

export function useToday(): IsoDate {
  const offset = useClockStore((s) => s.offsetDays);
  return todayForOffset(offset);
}
