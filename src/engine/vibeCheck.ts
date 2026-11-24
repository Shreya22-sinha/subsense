/** Vibe check (PRD 7.8) and "What you could have saved" (PRD 7.10). */
import { format, parseISO } from 'date-fns';
import { formatRs } from '@/lib/format';
import type {
  CatalogItem,
  Charge,
  IsoDate,
  Liking,
  Paise,
  Profile,
  Subscription,
  Usage,
} from '@/types/models';
import { daysUntil, monthlyShareOf } from './dates';
import {
  buildCheaperPlan,
  buildGoAnnual,
  buildSwap,
  makePickContext,
  type Pick,
} from './recommendations';
import { usageLevel, usesTaps, uses30 } from './usage';

const VIBE_INTERVAL = 30;
const VIBE_SOON = 7;

/** Answer labels map onto `liking`: "Not really" is stored as meh. */
export type VibeAnswer = 'love' | 'okay' | 'not_really';
export const VIBE_TO_LIKING: Record<VibeAnswer, Liking> = {
  love: 'love',
  okay: 'okay',
  not_really: 'meh',
};

/**
 * Due when not checked in the last 30 days AND either active for 30+ days or charging
 * within 7 days.
 */
export function isVibeCheckDue(sub: Subscription, today: IsoDate): boolean {
  if (sub.status !== 'active' || sub.category === 'Utilities') return false;
  if (sub.lastVibeCheckAt && -daysUntil(sub.lastVibeCheckAt, today) < VIBE_INTERVAL) return false;
  const activeDays = -daysUntil(sub.startDate, today);
  const nextIn = sub.nextChargeDate ? daysUntil(sub.nextChargeDate, today) : null;
  return activeDays >= VIBE_INTERVAL || (nextIn !== null && nextIn >= 0 && nextIn <= VIBE_SOON);
}

/** Home shows at most one per day: none once one was answered today; else the soonest charge. */
export function homeVibeCheck(subs: Subscription[], today: IsoDate): Subscription | null {
  if (subs.some((s) => s.lastVibeCheckAt === today)) return null;
  return (
    subs
      .filter((s) => isVibeCheckDue(s, today))
      .sort(
        (a, b) =>
          (a.nextChargeDate ?? '9999-12-31').localeCompare(b.nextChargeDate ?? '9999-12-31') ||
          a.name.localeCompare(b.name),
      )[0] ?? null
  );
}

export type VibeFollowUp =
  | { kind: 'pick'; text: string; pick: Pick }
  | { kind: 'cancel'; text: string; yearlyPaise: Paise }
  | { kind: 'none'; text: string };

/** The suggestion shown right after an answer. */
export function vibeFollowUp(
  sub: Subscription,
  answer: VibeAnswer,
  ctx: {
    profile: Profile;
    subscriptions: Subscription[];
    usages: Usage[];
    catalog: CatalogItem[];
    today: IsoDate;
  },
): VibeFollowUp {
  const pc = makePickContext(
    {
      profile: ctx.profile,
      subscriptions: ctx.subscriptions,
      usages: ctx.usages,
      dismissedPicks: [],
    },
    ctx.catalog,
    ctx.today,
  );
  const level = usageLevel(sub, uses30(ctx.usages, sub.id, ctx.today), ctx.today);

  if (answer === 'love') {
    const pick = level === 'high' ? buildGoAnnual(pc, sub) : null;
    return pick
      ? { kind: 'pick', text: 'Glad you love it. You could pay less by paying yearly.', pick }
      : { kind: 'none', text: `Great, we'll keep ${sub.name} as it is.` };
  }
  if (answer === 'okay') {
    const pick = level !== 'high' ? (buildCheaperPlan(pc, sub) ?? buildSwap(pc, sub)) : null;
    return pick
      ? { kind: 'pick', text: 'If it is just okay, a cheaper option might do.', pick }
      : { kind: 'none', text: "Noted. We'll check in again next month." };
  }
  const yearly = monthlyShareOf(sub) * 12;
  return {
    kind: 'cancel',
    text: `Save ${formatRs(yearly)} a year by cancelling ${sub.name}.`,
    yearlyPaise: yearly,
  };
}

// ---------- What you could have saved (7.10) ----------

export interface CouldHaveSaved {
  sub: Subscription;
  amountPaise: Paise;
  since: IsoDate;
  /** "Rs 2,388 on CineLite since March. You used it twice in the last 30 days." */
  text: string;
}

export const COULD_HAVE_SAVED_MIN = 10000;

function usedText(sub: Subscription, uses: number, today: IsoDate): string {
  if (!usesTaps(sub, today)) return `You rated your usage ${sub.usageRating} of 5.`;
  if (uses === 0) return "You haven't used it in the last 30 days.";
  if (uses === 1) return 'You used it once in the last 30 days.';
  if (uses === 2) return 'You used it twice in the last 30 days.';
  return `You used it ${uses} times in the last 30 days.`;
}

/**
 * For each subscription (active or not) that is "meh" or has lowUsageSince: the charges since
 * then. Top 3 by amount; empty when the total is under Rs 100.
 */
export function couldHaveSaved(
  subs: Subscription[],
  charges: Charge[],
  usages: Usage[],
  today: IsoDate,
): CouldHaveSaved[] {
  const rows: CouldHaveSaved[] = [];
  for (const sub of subs) {
    const since =
      sub.lowUsageSince ?? (sub.liking === 'meh' ? (sub.lastVibeCheckAt ?? sub.startDate) : null);
    if (!since) continue;
    const amountPaise = charges
      .filter((c) => c.subId === sub.id && daysUntil(c.date, since) >= 0)
      .reduce((sum, c) => sum + c.amountPaise, 0);
    if (amountPaise <= 0) continue;
    rows.push({
      sub,
      amountPaise,
      since,
      text: `${formatRs(amountPaise)} on ${sub.name} since ${format(parseISO(since), 'MMMM')}. ${usedText(sub, uses30(usages, sub.id, today), today)}`,
    });
  }
  const top = rows.sort((a, b) => b.amountPaise - a.amountPaise).slice(0, 3);
  const total = top.reduce((s, r) => s + r.amountPaise, 0);
  return total < COULD_HAVE_SAVED_MIN ? [] : top;
}
