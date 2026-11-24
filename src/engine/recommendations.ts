/**
 * Recommendations engine (PRD 7.7). Pure: profile, subscriptions, usage, dismissals and the
 * catalogue in; ranked picks out. The Share (family plan) pick is out of scope.
 *
 * Per subscription at most one savings pick: Decide always wins for trials, then the first
 * that matches in order Overlap, Trim, Student, Go annual, Swap. Discover suggests new things
 * in interest categories that fit the budget.
 */
import { formatRs } from '@/lib/format';
import type {
  BillingCycle,
  CatalogItem,
  CatalogPlan,
  Category,
  DismissedPick,
  IsoDate,
  Paise,
  Profile,
  Subscription,
  Usage,
} from '@/types/models';
import { budgetStatus } from './budget';
import { daysUntil, monthlyEquivalentPaise, monthlyShareOf, monthlyTotalPaise } from './dates';
import { INTEREST_THRESHOLD } from './quizScoring';
import { chargeWillHappen } from './rollover';
import { RATING_USES, usageLevel, usageSummary, usesTaps, uses30ById } from './usage';

export type PickType =
  'decide' | 'overlap' | 'trim' | 'student' | 'go_annual' | 'swap' | 'discover';

export const PICK_LABELS: Record<PickType, string> = {
  decide: 'Decide',
  overlap: 'Overlap',
  trim: 'Trim',
  student: 'Student price',
  go_annual: 'Go annual',
  swap: 'Swap',
  discover: 'Discover',
};

export interface Pick {
  /** Stable across days: <type>_<subId or catalogId>. */
  id: string;
  type: PickType;
  title: string;
  /** "Why this?": names the data used. */
  why: string;
  /** Positive = saves money per month; negative = adds cost (Discover). */
  monthlySavingPaise: Paise;
  confidence: number;
  /** Discover: the interest score. */
  interestScore?: number;
  category: Category;
  subId?: string;
  /** Swap / Discover / Student / Go annual: the catalogue item and plan involved. */
  catalogId?: string;
  planName?: string;
  /** The new price and cycle the pick would set (Student, Go annual, Swap, Discover). */
  newPricePaise?: Paise;
  newCycle?: BillingCycle;
}

export interface PickInput {
  profile: Profile;
  subscriptions: Subscription[];
  usages: Usage[];
  dismissedPicks: DismissedPick[];
}

export const FOR_YOU_LIMIT = 6;
const DECIDE_DAYS = 3;
const SWAP_MAX_RATIO = 0.7;
const DISCOVER_LIMIT = 3;
const CONFIDENCE = { overlap: 0.8, trim: 0.9, student: 0.95, go_annual: 0.7, swap: 0.6 } as const;

const inDays = (d: number) => (d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`);

// ---------- Context shared by the pick builders ----------

export interface PickContext {
  profile: Profile;
  subscriptions: Subscription[];
  catalog: CatalogItem[];
  uses: Map<string, number>;
  today: IsoDate;
}

export function makePickContext(
  input: PickInput,
  catalog: CatalogItem[],
  today: IsoDate,
): PickContext {
  return {
    profile: input.profile,
    subscriptions: input.subscriptions,
    catalog,
    uses: uses30ById(input.usages, today),
    today,
  };
}

const usesOf = (ctx: PickContext, s: Subscription) => ctx.uses.get(s.id) ?? 0;
const levelOf = (ctx: PickContext, s: Subscription) => usageLevel(s, usesOf(ctx, s), ctx.today);
const summaryOf = (ctx: PickContext, s: Subscription) => usageSummary(s, usesOf(ctx, s), ctx.today);
/** Estimated monthly uses: taps once tracked, else the rating's estimate. */
const estimatedUses = (ctx: PickContext, s: Subscription) =>
  usesTaps(s, ctx.today)
    ? usesOf(ctx, s)
    : RATING_USES[Math.min(5, Math.max(1, s.usageRating)) - 1];

function catalogItem(ctx: PickContext, id: string | null): CatalogItem | undefined {
  return id ? ctx.catalog.find((c) => c.id === id) : undefined;
}

/** The catalogue plan matching the subscription's plan name, else the first plan. */
function currentPlan(item: CatalogItem, sub: Subscription): CatalogPlan | undefined {
  return item.plans.find((p) => p.name === sub.planName) ?? item.plans[0];
}

const isRecurring = (p: CatalogPlan) => p.cycle !== 'one_time';
const planMonthly = (p: CatalogPlan) => monthlyEquivalentPaise(p.pricePaise, p.cycle);
const recurringActive = (ctx: PickContext) =>
  ctx.subscriptions.filter((s) => s.status === 'active' && s.cycle !== 'one_time');

// ---------- Savings pick builders (exported for the vibe check follow-ups) ----------

export function buildDecide(ctx: PickContext, s: Subscription): Pick | null {
  if (!s.isTrial || !s.trialEndDate || !s.autoRenew) return null;
  const d = daysUntil(s.trialEndDate, ctx.today);
  if (d < 0 || d > DECIDE_DAYS) return null;
  const monthly = monthlyShareOf(s);
  return {
    id: `decide_${s.id}`,
    type: 'decide',
    title: `Decide on your ${s.name} trial`,
    why: `Your free trial ends ${inDays(d)}. After that it's ${formatRs(monthly)}/month unless you cancel.`,
    monthlySavingPaise: monthly,
    confidence: 1,
    category: s.category,
    subId: s.id,
  };
}

function buildOverlap(ctx: PickContext, s: Subscription, sameCategory: number): Pick {
  return {
    id: `overlap_${s.id}`,
    type: 'overlap',
    title: `Drop ${s.name}? You have ${sameCategory} ${s.category} subscriptions`,
    why: `Of your ${s.category} subscriptions, ${s.name} is the one you use least (${summaryOf(ctx, s).toLowerCase()}). It costs ${formatRs(monthlyShareOf(s))}/month.`,
    monthlySavingPaise: monthlyShareOf(s),
    confidence: CONFIDENCE.overlap,
    category: s.category,
    subId: s.id,
  };
}

function buildTrim(ctx: PickContext, s: Subscription): Pick | null {
  const low = levelOf(ctx, s) === 'low';
  if (!low && s.liking !== 'meh') return null;
  const reason = s.liking === 'meh' ? `You said ${s.name} is meh` : summaryOf(ctx, s);
  return {
    id: `trim_${s.id}`,
    type: 'trim',
    title: `Pause or cancel ${s.name}`,
    why: `${reason}, and it costs ${formatRs(monthlyShareOf(s))}/month.`,
    monthlySavingPaise: monthlyShareOf(s),
    confidence: CONFIDENCE.trim,
    category: s.category,
    subId: s.id,
  };
}

function buildStudent(ctx: PickContext, s: Subscription): Pick | null {
  if (!ctx.profile.isStudent || s.cycle !== 'monthly') return null;
  const item = catalogItem(ctx, s.catalogId);
  const plan = item && currentPlan(item, s);
  if (!plan?.studentPaise || plan.studentPaise >= s.pricePaise) return null;
  const saving = monthlyShareOf(s) - plan.studentPaise;
  if (saving <= 0) return null;
  return {
    id: `student_${s.id}`,
    type: 'student',
    title: `Switch ${s.name} to the student plan`,
    why: `You told us you're a student. The student plan is ${formatRs(plan.studentPaise)}/month instead of ${formatRs(s.pricePaise)}.`,
    monthlySavingPaise: saving,
    confidence: CONFIDENCE.student,
    category: s.category,
    subId: s.id,
    catalogId: item?.id,
    planName: `${plan.name} (Student)`,
    newPricePaise: plan.studentPaise,
    newCycle: 'monthly',
  };
}

export function buildGoAnnual(ctx: PickContext, s: Subscription): Pick | null {
  if (s.cycle !== 'monthly') return null;
  if (levelOf(ctx, s) !== 'high' && s.usageRating < 4) return null;
  const item = catalogItem(ctx, s.catalogId);
  const plan = item && currentPlan(item, s);
  const yearly = plan?.yearlyPaise;
  if (!yearly || yearly >= 12 * s.pricePaise) return null;
  const saving = Math.round((12 * s.pricePaise - yearly) / 12 / Math.max(1, s.sharedWith));
  const usedText = usesTaps(s, ctx.today)
    ? `You used it ${usesOf(ctx, s)} times in the last 30 days`
    : `You rated your usage ${s.usageRating} of 5`;
  return {
    id: `go_annual_${s.id}`,
    type: 'go_annual',
    title: `Pay yearly for ${s.name}`,
    why: `${usedText}. Yearly works out to ${formatRs(Math.round(yearly / 12))}/month instead of ${formatRs(s.pricePaise)}.`,
    monthlySavingPaise: saving,
    confidence: CONFIDENCE.go_annual,
    category: s.category,
    subId: s.id,
    catalogId: item?.id,
    planName: plan?.name,
    newPricePaise: yearly,
    newCycle: 'yearly',
  };
}

/** A cheaper plan of the same service (vibe check "It's okay"), as a Swap in place. */
export function buildCheaperPlan(ctx: PickContext, s: Subscription): Pick | null {
  const item = catalogItem(ctx, s.catalogId);
  if (!item || item.isTemplate) return null;
  const current = monthlyEquivalentPaise(s.pricePaise, s.cycle);
  const cheaper = item.plans
    .filter((p) => isRecurring(p) && p.name !== s.planName && planMonthly(p) < current)
    .sort((a, b) => planMonthly(a) - planMonthly(b))[0];
  if (!cheaper) return null;
  const saving = Math.round((current - planMonthly(cheaper)) / Math.max(1, s.sharedWith));
  return {
    id: `swap_${s.id}_${cheaper.name}`,
    type: 'swap',
    title: `Move ${s.name} to the ${cheaper.name} plan`,
    why: `${summaryOf(ctx, s)}. ${cheaper.name} is ${formatRs(planMonthly(cheaper))}/month instead of ${formatRs(current)}.`,
    monthlySavingPaise: saving,
    confidence: CONFIDENCE.swap,
    category: s.category,
    subId: s.id,
    catalogId: item.id,
    planName: cheaper.name,
    newPricePaise: cheaper.pricePaise,
    newCycle: cheaper.cycle,
  };
}

export function buildSwap(ctx: PickContext, s: Subscription): Pick | null {
  if (levelOf(ctx, s) === 'high' || s.liking === 'love') return null;
  const share = monthlyShareOf(s);
  const held = new Set(
    recurringActive(ctx)
      .map((x) => x.catalogId)
      .filter(Boolean),
  );
  let best: { item: CatalogItem; plan: CatalogPlan; monthly: number } | undefined;
  for (const item of ctx.catalog) {
    if (
      item.isTemplate ||
      item.category !== s.category ||
      item.id === s.catalogId ||
      held.has(item.id)
    )
      continue;
    for (const plan of item.plans.filter(isRecurring)) {
      const m = planMonthly(plan);
      if (m > 0 && m <= share * SWAP_MAX_RATIO && (!best || m < best.monthly)) {
        best = { item, plan, monthly: m };
      }
    }
  }
  if (!best) return null;
  let confidence: number = CONFIDENCE.swap;
  if (ctx.profile.pricePreference === 'low') confidence *= 1.2;
  if (ctx.profile.pricePreference === 'quality') confidence *= 0.7;
  const pct = Math.round((1 - best.monthly / share) * 100);
  return {
    id: `swap_${s.id}_${best.item.id}`,
    type: 'swap',
    title: `Try ${best.item.name} instead of ${s.name}`,
    why: `${summaryOf(ctx, s)}. ${best.item.name} ${best.plan.name} costs ${formatRs(best.monthly)}/month, about ${pct}% less than ${formatRs(share)}.`,
    monthlySavingPaise: share - best.monthly,
    confidence,
    category: s.category,
    subId: s.id,
    catalogId: best.item.id,
    planName: best.plan.name,
    newPricePaise: best.plan.pricePaise,
    newCycle: best.plan.cycle,
  };
}

// ---------- Discover ----------

const INTEREST_REASONS: Array<{
  category: Category;
  q: 'q1' | 'q2' | 'q3' | 'q6';
  id: string;
  text: string;
}> = [
  { category: 'Learning', q: 'q6', id: 'language', text: 'You said you want to learn a language' },
  { category: 'Learning', q: 'q6', id: 'career', text: 'You said you want to grow your career' },
  { category: 'Learning', q: 'q1', id: 'learning', text: 'You like learning new skills' },
  { category: 'Reading', q: 'q6', id: 'read_more', text: 'You said you want to read more' },
  { category: 'Reading', q: 'q1', id: 'reading', text: 'You like reading in your free time' },
  { category: 'Fitness', q: 'q6', id: 'get_fit', text: 'You said you want to get fit' },
  { category: 'Fitness', q: 'q1', id: 'workout', text: 'You like working out' },
  { category: 'Video', q: 'q1', id: 'binge', text: 'You like binge-watching shows' },
  { category: 'Gaming', q: 'q1', id: 'gaming', text: 'You like gaming' },
  { category: 'Music', q: 'q2', id: 'all_day', text: 'You listen to music all day' },
  { category: 'Music', q: 'q2', id: 'commute', text: 'You listen to music on your commute' },
  { category: 'Productivity', q: 'q3', id: 'freelancer', text: "You're a freelancer" },
  {
    category: 'Productivity',
    q: 'q6',
    id: 'career',
    text: 'You said you want to grow your career',
  },
  { category: 'Productivity', q: 'q1', id: 'making', text: 'You like making things' },
  { category: 'Cloud', q: 'q1', id: 'making', text: 'You like making things' },
  { category: 'Cloud', q: 'q3', id: 'freelancer', text: "You're a freelancer" },
];

function interestReason(profile: Profile, category: Category): string {
  const a = profile.quizAnswers;
  const hit = INTEREST_REASONS.find((r) => {
    if (r.category !== category) return false;
    const answer = a[r.q];
    return Array.isArray(answer) ? answer.includes(r.id) : answer === r.id;
  });
  return hit?.text ?? `Your quiz answers point to ${category.toLowerCase()}`;
}

function buildDiscover(ctx: PickContext, headroom: Paise): Pick[] {
  const { profile } = ctx;
  const activeCategories = new Set(recurringActive(ctx).map((s) => s.category));
  const picks: Pick[] = [];

  const interests = (Object.entries(profile.interestScores) as [Category, number][])
    .filter(
      ([c, score]) => score >= INTEREST_THRESHOLD && c !== 'Utilities' && !activeCategories.has(c),
    )
    .sort((a, b) => b[1] - a[1]);

  for (const [category, score] of interests) {
    let best:
      { item: CatalogItem; plan: CatalogPlan; monthly: number; student: boolean } | undefined;
    for (const item of ctx.catalog) {
      if (item.isTemplate || item.category !== category) continue;
      const plans = item.plans
        .filter(isRecurring)
        .map((plan) => {
          const student = profile.isStudent && !!plan.studentPaise;
          const monthly = student ? plan.studentPaise! : planMonthly(plan);
          return { plan, monthly, student };
        })
        .sort((a, b) => a.monthly - b.monthly);
      if (!plans.length) continue;
      // isStudent prefers plans with a student price; "Best quality" prefers the standard
      // (second-cheapest) plan over the cheapest.
      const studentPlans = plans.filter((p) => p.student);
      const pool = studentPlans.length ? studentPlans : plans;
      const chosen = profile.pricePreference === 'quality' && pool.length > 1 ? pool[1] : pool[0];
      if (chosen.monthly > headroom) continue;
      if (!best || chosen.monthly < best.monthly) best = { item, ...chosen };
    }
    if (!best) continue;
    picks.push({
      id: `discover_${best.item.id}`,
      type: 'discover',
      title: `Try ${best.item.name}${best.plan.name ? ` (${best.plan.name})` : ''}`,
      why: `${interestReason(profile, category)}, and you have ${formatRs(headroom)} of budget room. It's ${formatRs(best.monthly)}/month${best.student ? ' with a student price' : ''}.`,
      monthlySavingPaise: -best.monthly,
      confidence: 1,
      interestScore: score,
      category,
      catalogId: best.item.id,
      planName: best.plan.name,
      newPricePaise: best.student ? best.plan.studentPaise : best.plan.pricePaise,
      newCycle: best.student ? 'monthly' : best.plan.cycle,
    });
  }
  return picks.slice(0, profile.savingsFocus ? 1 : DISCOVER_LIMIT);
}

// ---------- All picks ----------

export interface PicksResult {
  /** All visible picks, ranked. */
  ranked: Pick[];
  overBudget: boolean;
  /** Budget minus monthly total; negative when over. */
  headroomPaise: Paise;
}

/** Ranking: Decide first; then savings by saving x confidence; then Discover by interest. */
function rankKey(p: Pick): [number, number] {
  if (p.type === 'decide') return [0, -p.monthlySavingPaise];
  if (p.type === 'discover') return [2, -(p.interestScore ?? 0)];
  return [1, -(p.monthlySavingPaise * p.confidence)];
}

export function isDismissed(pickId: string, dismissed: DismissedPick[], today: IsoDate): boolean {
  return dismissed.some((d) => d.pickId === pickId && daysUntil(d.until, today) > 0);
}

export function computePicks(
  input: PickInput,
  catalog: CatalogItem[],
  today: IsoDate,
): PicksResult {
  const ctx = makePickContext(input, catalog, today);
  // A plan that is already ending (auto-renew off or past its end date) has nothing to save.
  const active = recurringActive(ctx).filter(
    (s) =>
      s.category !== 'Utilities' && (!s.nextChargeDate || chargeWillHappen(s, s.nextChargeDate)),
  );
  const status = budgetStatus(monthlyTotalPaise(input.subscriptions), input.profile.budgetPaise);

  // Overlap: in each category with 2+ active subscriptions, the least used (ties: pricier).
  const overlapTargets = new Map<string, number>();
  const byCategory = new Map<Category, Subscription[]>();
  for (const s of active) byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), s]);
  for (const subs of byCategory.values()) {
    if (subs.length < 2) continue;
    const target = [...subs].sort(
      (a, b) =>
        estimatedUses(ctx, a) - estimatedUses(ctx, b) || monthlyShareOf(b) - monthlyShareOf(a),
    )[0];
    overlapTargets.set(target.id, subs.length);
  }

  const savings: Pick[] = [];
  for (const s of active) {
    const pick =
      buildDecide(ctx, s) ??
      (s.isTrial
        ? null
        : ((overlapTargets.has(s.id) ? buildOverlap(ctx, s, overlapTargets.get(s.id)!) : null) ??
          buildTrim(ctx, s) ??
          buildStudent(ctx, s) ??
          buildGoAnnual(ctx, s) ??
          buildSwap(ctx, s)));
    if (pick) {
      if (input.profile.savingsFocus && pick.type !== 'decide') pick.confidence *= 1.2;
      savings.push(pick);
    }
  }

  const discover = status.over ? [] : buildDiscover(ctx, status.headroomPaise);

  const ranked = [...savings, ...discover]
    .filter((p) => !isDismissed(p.id, input.dismissedPicks, today))
    .sort((a, b) => {
      const [ga, va] = rankKey(a);
      const [gb, vb] = rankKey(b);
      return ga - gb || va - vb;
    });

  return { ranked, overBudget: status.over, headroomPaise: status.headroomPaise };
}

/** "Potential savings": the sum of positive monthly savings of the shown picks. */
export function potentialSavings(picks: Pick[]): Paise {
  return picks.reduce((sum, p) => sum + Math.max(0, p.monthlySavingPaise), 0);
}

export const isSavingsPick = (p: Pick) => p.type !== 'discover';
