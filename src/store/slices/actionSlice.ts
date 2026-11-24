/**
 * Action Center decisions (PRD 7.6). Each decision stores an ActionState so the item does
 * not come back for the same date, and logs decision_made with source action_center.
 */
import type { ActionItem } from '@/engine/actions';
import { addDaysIso, monthlyShareOf } from '@/engine/dates';
import { newId } from '@/lib/id';
import type { ActionState } from '@/types/models';
import { activityText } from '../activityText';
import { getNowIso, getToday } from '../clockStore';
import type { DataSlice } from './types';

export type ActionDecision =
  | 'keep'
  | 'cancel'
  | 'pause'
  | 'still_worth_it'
  | 'renew'
  | 'let_it_end'
  | 'confirmed_paid'
  | 'not_charged'
  | 'remind_tomorrow';

const DECISION_TEXT: Record<ActionDecision, (name: string) => string> = {
  keep: (n) => `You decided to keep ${n}.`,
  cancel: (n) => `You decided to cancel ${n}.`,
  pause: (n) => `You paused ${n} from the Action Center.`,
  still_worth_it: (n) => `You decided ${n} is still worth it.`,
  renew: (n) => `You chose to renew ${n}.`,
  let_it_end: (n) => `You're letting ${n} end.`,
  confirmed_paid: (n) => `You confirmed the ${n} charge.`,
  not_charged: (n) => `You said ${n} didn't charge you because you'd cancelled.`,
  remind_tomorrow: (n) => `You asked to be reminded about ${n} tomorrow.`,
};

export interface ActionSlice {
  /** Record a decision on an item and hide it for this date. */
  resolveAction: (item: ActionItem, decision: Exclude<ActionDecision, 'remind_tomorrow'>) => void;
  /** "Remind me tomorrow": hide the item until the next demo day. */
  snoozeAction: (item: ActionItem) => void;
  /**
   * "No, I'd cancelled" on a Confirm item: remove the charge, mark the subscription
   * cancelled as of that date, and record the saving.
   */
  rejectCharge: (item: ActionItem) => void;
}

export const createActionSlice: DataSlice<ActionSlice> = (set, get) => {
  const record = (item: ActionItem, state: ActionState, decision: ActionDecision) => {
    set({
      actionStates: [...get().actionStates.filter((s) => s.itemId !== item.id), state],
    });
    get().logActivity('decision_made', DECISION_TEXT[decision](item.subName), {
      subId: item.subId,
      data: { decision, source: 'action_center', level: item.level, itemId: item.id },
    });
  };

  return {
    resolveAction: (item, decision) =>
      record(item, { itemId: item.id, state: 'done', until: item.date }, decision),

    snoozeAction: (item) =>
      record(
        item,
        { itemId: item.id, state: 'snoozed', until: addDaysIso(getToday(), 1) },
        'remind_tomorrow',
      ),

    rejectCharge: (item) => {
      const state = get();
      const sub = state.subscriptions.find((s) => s.id === item.subId);
      if (!sub) return;
      const monthlyPaise = monthlyShareOf(sub);
      set({
        charges: state.charges.filter((c) => c.id !== item.chargeId),
        subscriptions: state.subscriptions.map((s) =>
          s.id === sub.id
            ? {
                ...s,
                status: 'cancelled',
                endDate: item.date,
                cancelledAt: item.date,
                nextChargeDate: null,
                updatedAt: getNowIso(),
              }
            : s,
        ),
        savings:
          monthlyPaise > 0
            ? [
                ...state.savings,
                {
                  id: newId(),
                  subId: sub.id,
                  monthlyPaise,
                  startDate: item.date,
                  source: 'cancel',
                },
              ]
            : state.savings,
      });
      get().logActivity('subscription_cancelled', activityText.cancelled(sub, monthlyPaise), {
        subId: sub.id,
        data: { monthlyPaise, source: 'action_center' },
      });
      record(item, { itemId: item.id, state: 'done', until: item.date }, 'not_charged');
    },
  };
};
