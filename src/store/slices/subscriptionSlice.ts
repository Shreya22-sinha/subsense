/**
 * Subscription actions (PRD 6.6–6.8, 7.1): add, edit, delete with undo, pause, resume,
 * cancel, keep, and rollover. Rules live in src/engine; this file records the results
 * and logs an Activity for every user-visible change.
 */
import { getCatalogItem } from '@/data/catalog';
import { monthlyShareOf, nextChargeDate } from '@/engine/dates';
import { rollover, type RolloverCharge, type RolloverEvent } from '@/engine/rollover';
import { lowUsageUpdates } from '@/engine/usage';
import {
  applyEdit,
  createSubscription,
  subscriptionFromCatalog,
  type CreateResult,
  type EditResult,
  type SubscriptionInput,
} from '@/engine/subscriptions';
import { newId } from '@/lib/id';
import type {
  Activity,
  Charge,
  IsoDate,
  PriceChange,
  Saving,
  Subscription,
  Usage,
} from '@/types/models';
import { activityText } from '../activityText';
import { getNowIso, getToday } from '../clockStore';
import type { DataSlice, DataState } from './types';

/** What delete removed, so Undo can put it back exactly. */
export interface DeletedSnapshot {
  sub: Subscription;
  index: number;
  charges: Charge[];
  usages: Usage[];
  priceChanges: PriceChange[];
  savings: Saving[];
  activityId: string;
}

export interface SubscriptionSlice {
  addSubscription: (
    input: SubscriptionInput,
    opts?: { nextChargeOverride?: IsoDate | null },
  ) => Subscription;
  addSubscriptionsFromCatalog: (catalogIds: string[]) => void;
  /** Returns the edit result plus the id of the PriceChange it recorded, if any. */
  updateSubscription: (
    id: string,
    input: SubscriptionInput,
    opts?: { nextChargeOverride?: IsoDate | null },
  ) => (EditResult & { priceChangeId: string | null }) | null;
  deleteSubscription: (id: string) => DeletedSnapshot | null;
  restoreSubscription: (snapshot: DeletedSnapshot) => void;
  pauseSubscription: (id: string) => void;
  resumeSubscription: (id: string) => void;
  /** After the user cancels on the official site (PRD 6.8). Records a Saving. */
  cancelSubscription: (id: string) => void;
  keepSubscription: (id: string) => void;
  /** Bring every active subscription's billing up to today (on load and clock change). */
  runRollover: () => void;
  /** "Remind me at renewal" on the price-hike alert (PRD 7.5). */
  remindPriceHikeAtRenewal: (priceChangeId: string) => void;
  /** Keep lowUsageSince in step with usage (PRD 7.3). */
  syncUsageFlags: () => void;
}

/** Local noon of a date as an ISO timestamp, for records dated by charge date. */
function atDate(date: IsoDate): string {
  return new Date(`${date}T12:00:00`).toISOString();
}

export function toCharges(
  subId: string,
  charges: RolloverCharge[],
  source: Charge['source'],
): Charge[] {
  return charges.map((c) => ({
    id: newId(),
    subId,
    date: c.date,
    amountPaise: c.amountPaise,
    source,
  }));
}

function eventActivities(sub: Subscription, events: RolloverEvent[]): Activity[] {
  return events.map((e) => {
    const base = { id: newId(), at: atDate(e.date), subId: sub.id };
    switch (e.type) {
      case 'charged':
        return {
          ...base,
          type: 'charged',
          data: { amountPaise: e.amountPaise, date: e.date },
          text: activityText.charged(sub, e.amountPaise, e.date),
        };
      case 'trial_converted':
        return {
          ...base,
          type: 'trial_converted',
          data: { amountPaise: e.amountPaise, date: e.date },
          text: activityText.trialConverted(sub, e.amountPaise),
        };
      case 'subscription_ended':
        return { ...base, type: 'subscription_ended', data: {}, text: activityText.ended(sub) };
    }
  });
}

function findSub(state: DataState, id: string): Subscription | undefined {
  return state.subscriptions.find((s) => s.id === id);
}

function replaceSub(state: DataState, sub: Subscription): Subscription[] {
  return state.subscriptions.map((s) => (s.id === sub.id ? sub : s));
}

export const createSubscriptionSlice: DataSlice<SubscriptionSlice> = (set, get) => {
  const buildCtx = () => ({
    id: newId(),
    today: getToday(),
    now: getNowIso(),
    defaultReminderDays: get().profile.defaultReminderDays,
  });

  /** Append newly created subscriptions with their payment history and "added" activities. */
  const commitCreated = (results: CreateResult[], source: string) => {
    const state = get();
    set({
      subscriptions: [...state.subscriptions, ...results.map((r) => r.sub)],
      charges: [
        ...state.charges,
        ...results.flatMap((r) => toCharges(r.sub.id, r.charges, 'backfill')),
      ],
    });
    for (const r of results) {
      get().logActivity('subscription_added', activityText.added(r.sub), {
        subId: r.sub.id,
        data: { source },
      });
    }
  };

  return {
    addSubscription: (input, opts) => {
      const result = createSubscription(input, buildCtx(), opts);
      commitCreated([result], 'form');
      return result.sub;
    },

    addSubscriptionsFromCatalog: (catalogIds) => {
      const results = catalogIds
        .map((id) => getCatalogItem(id))
        .filter((item) => item !== undefined)
        .map((item) => subscriptionFromCatalog(item, buildCtx()));
      if (results.length) commitCreated(results, 'onboarding');
    },

    updateSubscription: (id, input, opts) => {
      const state = get();
      const old = findSub(state, id);
      if (!old) return null;
      const today = getToday();
      const result = applyEdit(
        old,
        input,
        {
          today,
          now: getNowIso(),
          chargedToday: state.charges.some((c) => c.subId === id && c.date === today),
        },
        opts,
      );

      set({ subscriptions: replaceSub(state, result.sub) });
      get().logActivity(
        'subscription_edited',
        activityText.edited(result.sub, result.changedFields),
        {
          subId: id,
          data: { fields: result.changedFields },
        },
      );

      let priceChangeId: string | null = null;
      if (result.priceChange) {
        const { oldPaise, newPaise, sameCycle } = result.priceChange;
        priceChangeId = newId();
        set({
          priceChanges: [
            ...get().priceChanges,
            {
              id: priceChangeId,
              subId: id,
              date: today,
              oldPaise,
              newPaise,
              cycleChanged: !sameCycle,
            },
          ],
        });
        get().logActivity(
          'price_changed',
          activityText.priceChanged(result.sub, oldPaise, newPaise),
          {
            subId: id,
            data: { ...result.priceChange },
          },
        );
      }
      get().syncUsageFlags();
      return { ...result, priceChangeId };
    },

    deleteSubscription: (id) => {
      const state = get();
      const index = state.subscriptions.findIndex((s) => s.id === id);
      if (index < 0) return null;
      const sub = state.subscriptions[index];
      const mine = <T extends { subId: string }>(list: T[]) => list.filter((r) => r.subId === id);
      const others = <T extends { subId: string }>(list: T[]) => list.filter((r) => r.subId !== id);

      const snapshot: Omit<DeletedSnapshot, 'activityId'> = {
        sub,
        index,
        charges: mine(state.charges),
        usages: mine(state.usages),
        priceChanges: mine(state.priceChanges),
        savings: mine(state.savings),
      };
      set({
        subscriptions: state.subscriptions.filter((s) => s.id !== id),
        charges: others(state.charges),
        usages: others(state.usages),
        priceChanges: others(state.priceChanges),
        savings: others(state.savings),
      });
      const activityId = get().logActivity('subscription_deleted', activityText.deleted(sub), {
        subId: id,
      });
      return { ...snapshot, activityId };
    },

    restoreSubscription: (snap) => {
      const state = get();
      if (findSub(state, snap.sub.id)) return;
      const subscriptions = [...state.subscriptions];
      subscriptions.splice(Math.min(snap.index, subscriptions.length), 0, snap.sub);
      set({
        subscriptions,
        charges: [...state.charges, ...snap.charges],
        usages: [...state.usages, ...snap.usages],
        priceChanges: [...state.priceChanges, ...snap.priceChanges],
        savings: [...state.savings, ...snap.savings],
        activities: state.activities.filter((a) => a.id !== snap.activityId),
      });
    },

    pauseSubscription: (id) => {
      const sub = findSub(get(), id);
      if (!sub || sub.status !== 'active') return;
      const paused: Subscription = { ...sub, status: 'paused', updatedAt: getNowIso() };
      set({ subscriptions: replaceSub(get(), paused) });
      get().logActivity('subscription_paused', activityText.paused(sub), { subId: id });
    },

    resumeSubscription: (id) => {
      const state = get();
      const sub = findSub(state, id);
      if (!sub || sub.status !== 'paused') return;
      const today = getToday();
      // Billing picks up from the next date in the series; paused periods are not charged.
      const resumed: Subscription = {
        ...sub,
        status: 'active',
        updatedAt: getNowIso(),
        nextChargeDate: nextChargeDate(sub, today, {
          afterToday: state.charges.some((c) => c.subId === id && c.date === today),
        }),
      };
      set({
        subscriptions: replaceSub(state, resumed),
        // A pause saving ends when the subscription resumes.
        savings: state.savings.filter((s) => !(s.subId === id && s.source === 'pause')),
      });
      get().logActivity('subscription_resumed', activityText.resumed(sub), { subId: id });
    },

    cancelSubscription: (id) => {
      const state = get();
      const sub = findSub(state, id);
      if (!sub || sub.status === 'cancelled' || sub.status === 'ended') return;
      const today = getToday();
      const monthlyPaise = monthlyShareOf(sub);
      const cancelled: Subscription = {
        ...sub,
        status: 'cancelled',
        cancelledAt: today,
        nextChargeDate: null,
        updatedAt: getNowIso(),
      };
      const savings =
        monthlyPaise > 0
          ? [
              ...state.savings,
              {
                id: newId(),
                subId: id,
                monthlyPaise,
                startDate: today,
                source: sub.isTrial ? ('trial_stopped' as const) : ('cancel' as const),
              },
            ]
          : state.savings;
      set({ subscriptions: replaceSub(state, cancelled), savings });
      get().logActivity('subscription_cancelled', activityText.cancelled(sub, monthlyPaise), {
        subId: id,
        data: { monthlyPaise, wasTrial: sub.isTrial },
      });
    },

    keepSubscription: (id) => {
      const sub = findSub(get(), id);
      if (!sub) return;
      get().logActivity('decision_made', activityText.kept(sub), {
        subId: id,
        data: { decision: 'keep', source: 'detail' },
      });
    },

    runRollover: () => {
      const state = get();
      const today = getToday();
      let changed = false;
      const newCharges: Charge[] = [];
      const newActivities: Activity[] = [];

      const subscriptions = state.subscriptions.map((sub) => {
        const r = rollover(sub, today);
        if (r.events.length === 0) return sub;
        changed = true;
        newCharges.push(...toCharges(sub.id, r.charges, 'rollover'));
        newActivities.push(...eventActivities(sub, r.events));
        return r.sub;
      });

      if (changed) {
        set({
          subscriptions,
          charges: [...state.charges, ...newCharges],
          activities: [...state.activities, ...newActivities],
        });
      }
      // Usage windows move with the clock even when nothing was charged.
      get().syncUsageFlags();
    },

    remindPriceHikeAtRenewal: (priceChangeId) =>
      set({
        priceChanges: get().priceChanges.map((p) =>
          p.id === priceChangeId ? { ...p, remindAtRenewal: true } : p,
        ),
      }),

    syncUsageFlags: () => {
      const state = get();
      const updates = lowUsageUpdates(state.subscriptions, state.usages, getToday());
      if (updates.size === 0) return;
      set({
        subscriptions: state.subscriptions.map((s) =>
          updates.has(s.id) ? { ...s, lowUsageSince: updates.get(s.id) ?? null } : s,
        ),
      });
    },
  };
};
