/** "I used it" (PRD 7.4): one Usage per subscription per day, with undo. */
import { newId } from '@/lib/id';
import { getToday } from '../clockStore';
import type { DataSlice } from './types';

export type LogUsageResult =
  | { status: 'logged'; usageId: string; activityId: string }
  | { status: 'already' }
  | { status: 'missing' };

export interface UsageSlice {
  logUsage: (subId: string) => LogUsageResult;
  undoUsage: (usageId: string, activityId: string) => void;
}

export const createUsageSlice: DataSlice<UsageSlice> = (set, get) => ({
  logUsage: (subId) => {
    const state = get();
    const sub = state.subscriptions.find((s) => s.id === subId);
    if (!sub) return { status: 'missing' };
    const today = getToday();
    if (state.usages.some((u) => u.subId === subId && u.date === today)) {
      return { status: 'already' };
    }
    const usageId = newId();
    set({ usages: [...state.usages, { id: usageId, subId, date: today }] });
    const activityId = get().logActivity('usage_logged', `You used ${sub.name}.`, { subId });
    get().syncUsageFlags();
    return { status: 'logged', usageId, activityId };
  },

  undoUsage: (usageId, activityId) => {
    set({
      usages: get().usages.filter((u) => u.id !== usageId),
      activities: get().activities.filter((a) => a.id !== activityId),
    });
    get().syncUsageFlags();
  },
});
