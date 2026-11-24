/**
 * Recommendation and vibe-check actions (PRD 7.7, 7.8). Every pick that saves money records
 * a Saving (subId, monthly amount, start date, source) and logs recommendation_accepted.
 * "Not for me" hides a pick for 30 days and logs recommendation_dismissed with the reason.
 */
import { getCatalogItem } from '@/data/catalog';
import { addDaysIso } from '@/engine/dates';
import type { Pick } from '@/engine/recommendations';
import { createSubscription } from '@/engine/subscriptions';
import { VIBE_TO_LIKING, type VibeAnswer } from '@/engine/vibeCheck';
import { formatRs } from '@/lib/format';
import { newId } from '@/lib/id';
import type { DismissedPick, SavingSource, Subscription } from '@/types/models';
import { getNowIso, getToday } from '../clockStore';
import { toCharges } from './subscriptionSlice';
import type { DataSlice } from './types';

export const DISMISS_DAYS = 30;

export const DISMISS_REASONS: Record<DismissedPick['reason'], string> = {
  already_done: 'Already done',
  not_relevant: 'Not relevant',
  dont_want_to_change: "Don't want to change",
};

const VIBE_TEXT: Record<VibeAnswer, (name: string) => string> = {
  love: (n) => `You said you love ${n}.`,
  okay: (n) => `You said ${n} is okay.`,
  not_really: (n) => `You said you're not really enjoying ${n}.`,
};

export interface PickSlice {
  /** Log an accepted pick whose real effect happened elsewhere (cancel sheet, add form). */
  markPickAccepted: (pick: Pick) => void;
  dismissPick: (pick: Pick, reason: DismissedPick['reason']) => void;
  /** Decide pick, "Keep it": hide the pick until the trial has ended. */
  keepTrial: (pick: Pick) => void;
  /** Student price, Go annual, or a cheaper plan of the same service: change the plan in place. */
  applyPlanChange: (pick: Pick) => void;
  /** Swap to a different service: cancel the old one, add the new one from its next charge. */
  applySwap: (pick: Pick) => void;
  /** Trim pick, "Pause": pause and record the saving (removed again on resume). */
  pauseFromPick: (pick: Pick) => void;
  answerVibeCheck: (subId: string, answer: VibeAnswer) => void;
}

export const createPickSlice: DataSlice<PickSlice> = (set, get) => {
  const findSub = (id?: string) => get().subscriptions.find((s) => s.id === id);

  const accept = (pick: Pick, text: string, saving?: { source: SavingSource; subId: string }) => {
    if (saving && pick.monthlySavingPaise > 0) {
      set({
        savings: [
          ...get().savings,
          {
            id: newId(),
            subId: saving.subId,
            monthlyPaise: pick.monthlySavingPaise,
            startDate: getToday(),
            source: saving.source,
          },
        ],
      });
    }
    get().logActivity('recommendation_accepted', text, {
      subId: pick.subId,
      data: { pickId: pick.id, type: pick.type, monthlySavingPaise: pick.monthlySavingPaise },
    });
  };

  return {
    markPickAccepted: (pick) => accept(pick, `You acted on an idea: ${pick.title}.`),

    dismissPick: (pick, reason) => {
      set({
        dismissedPicks: [
          ...get().dismissedPicks.filter((d) => d.pickId !== pick.id),
          { pickId: pick.id, reason, until: addDaysIso(getToday(), DISMISS_DAYS) },
        ],
      });
      get().logActivity(
        'recommendation_dismissed',
        `Not for you: ${pick.title} (${DISMISS_REASONS[reason].toLowerCase()}).`,
        { subId: pick.subId, data: { pickId: pick.id, type: pick.type, reason } },
      );
    },

    keepTrial: (pick) => {
      const sub = findSub(pick.subId);
      if (!sub) return;
      const until = addDaysIso(sub.trialEndDate ?? getToday(), 1);
      set({
        dismissedPicks: [
          ...get().dismissedPicks.filter((d) => d.pickId !== pick.id),
          { pickId: pick.id, reason: 'already_done', until },
        ],
      });
      get().logActivity('decision_made', `You decided to keep your ${sub.name} trial.`, {
        subId: sub.id,
        data: { decision: 'keep', source: 'picks', pickId: pick.id },
      });
    },

    applyPlanChange: (pick) => {
      const sub = findSub(pick.subId);
      if (!sub || pick.newPricePaise === undefined || !pick.newCycle) return;
      const today = getToday();
      const cycleChanged = pick.newCycle !== sub.cycle;
      const updated: Subscription = {
        ...sub,
        planName: pick.planName ?? sub.planName,
        pricePaise: pick.newPricePaise,
        cycle: pick.newCycle,
        // A new cycle starts at the next renewal, so the next charge date stays put.
        chargeAnchor: cycleChanged ? (sub.nextChargeDate ?? sub.chargeAnchor) : sub.chargeAnchor,
        updatedAt: getNowIso(),
      };
      set({
        subscriptions: get().subscriptions.map((s) => (s.id === sub.id ? updated : s)),
        priceChanges: [
          ...get().priceChanges,
          {
            id: newId(),
            subId: sub.id,
            date: today,
            oldPaise: sub.pricePaise,
            newPaise: pick.newPricePaise,
            cycleChanged,
          },
        ],
      });
      const save = formatRs(pick.monthlySavingPaise);
      const text =
        pick.type === 'student'
          ? `You switched ${sub.name} to the student plan and save ${save}/month.`
          : pick.type === 'go_annual'
            ? `You switched ${sub.name} to yearly billing and save ${save}/month.`
            : `You moved ${sub.name} to the ${pick.planName} plan and save ${save}/month.`;
      const source: SavingSource =
        pick.type === 'student' ? 'student' : pick.type === 'go_annual' ? 'switch_annual' : 'swap';
      accept(pick, text, { source, subId: sub.id });
    },

    applySwap: (pick) => {
      const old = findSub(pick.subId);
      const item = getCatalogItem(pick.catalogId);
      if (!old || !item || pick.newPricePaise === undefined || !pick.newCycle) return;
      const today = getToday();
      const created = createSubscription(
        {
          catalogId: item.id,
          name: item.name,
          planName: pick.planName ?? '',
          category: item.category,
          pricePaise: pick.newPricePaise,
          cycle: pick.newCycle,
          // Start when the old one would next charge, so you never pay for both.
          startDate: old.nextChargeDate ?? today,
          reminderDays: old.reminderDays,
        },
        {
          id: newId(),
          today,
          now: getNowIso(),
          defaultReminderDays: get().profile.defaultReminderDays,
        },
      );
      set({
        subscriptions: [
          ...get().subscriptions.map((s) =>
            s.id === old.id
              ? {
                  ...s,
                  status: 'cancelled' as const,
                  cancelledAt: today,
                  nextChargeDate: null,
                  updatedAt: getNowIso(),
                }
              : s,
          ),
          created.sub,
        ],
        charges: [...get().charges, ...toCharges(created.sub.id, created.charges, 'backfill')],
      });
      get().logActivity(
        'subscription_added',
        `You added ${item.name} (swapped from ${old.name}).`,
        {
          subId: created.sub.id,
          data: { source: 'swap' },
        },
      );
      accept(
        pick,
        `You swapped ${old.name} for ${item.name} and save ${formatRs(pick.monthlySavingPaise)}/month.`,
        { source: 'swap', subId: old.id },
      );
    },

    pauseFromPick: (pick) => {
      const sub = findSub(pick.subId);
      if (!sub) return;
      get().pauseSubscription(sub.id);
      accept(pick, `You paused ${sub.name} and save ${formatRs(pick.monthlySavingPaise)}/month.`, {
        source: 'pause',
        subId: sub.id,
      });
    },

    answerVibeCheck: (subId, answer) => {
      const sub = findSub(subId);
      if (!sub) return;
      const today = getToday();
      set({
        subscriptions: get().subscriptions.map((s) =>
          s.id === subId
            ? {
                ...s,
                liking: VIBE_TO_LIKING[answer],
                lastVibeCheckAt: today,
                updatedAt: getNowIso(),
              }
            : s,
        ),
      });
      get().logActivity('vibe_check_answered', VIBE_TEXT[answer](sub.name), {
        subId,
        data: { answer },
      });
    },
  };
};
