/**
 * The demo account must show every action level and badge on first load (PRD 9.2, step 9
 * acceptance), whatever today's date is. Checked for every day of a year, including month
 * ends and a leap day.
 */
import { describe, expect, it } from 'vitest';
import { computeActionItems } from '@/engine/actions';
import { computeBadges } from '@/engine/badges';
import { addDaysIso, monthlyTotalPaise } from '@/engine/dates';
import { INTEREST_THRESHOLD } from '@/engine/quizScoring';
import { computePicks } from '@/engine/recommendations';
import { couldHaveSaved, homeVibeCheck } from '@/engine/vibeCheck';
import { CATALOG } from './catalog';
import { buildDemoData } from './demoAccount';

function build(today: string) {
  let n = 0;
  return buildDemoData({
    today,
    at: (days) => new Date(new Date(`${addDaysIso(today, days)}T10:00:00`)).toISOString(),
    newId: () => `id${++n}`,
  });
}

const ALL_LEVELS = ['urgent', 'review', 'headsup', 'ending', 'confirm'];
// Student needs isStudent; the PRD's demo profile is not a student (checked separately).
const ALL_PICKS = ['decide', 'overlap', 'trim', 'go_annual', 'swap', 'discover'];
const ALL_BADGES = [
  'trial_ending',
  'price_up',
  'renews_soon',
  'least_used',
  'duplicate',
  'most_used',
  'priciest',
  'best_value',
];

describe('demo account', () => {
  const days = Array.from({ length: 366 }, (_, i) => addDaysIso('2027-01-01', i)); // includes 2027-12-31

  it('shows every action level and badge on any day of the year', { timeout: 30_000 }, () => {
    const failures: string[] = [];
    for (const today of [...days, '2028-02-29', '2028-03-01']) {
      const data = build(today);
      const items = computeActionItems(data, today);
      const levels = new Set(items.map((i) => i.level));
      const badges = new Set(
        [...computeBadges(data.subscriptions, { ...data, today }).values()]
          .flat()
          .map((b) => b.kind),
      );
      const pickTypes = new Set(computePicks(data, CATALOG, today).ranked.map((p) => p.type));
      const missing = [
        ...ALL_PICKS.filter((p) => !pickTypes.has(p as never)),
        ...(couldHaveSaved(data.subscriptions, data.charges, data.usages, today).length
          ? []
          : ['could-have-saved']),
        ...(homeVibeCheck(data.subscriptions, today) ? [] : ['vibe-check']),
        ...ALL_LEVELS.filter((l) => !levels.has(l as never)),
        ...ALL_BADGES.filter((b) => !badges.has(b as never)),
      ];
      if (missing.length) failures.push(`${today}: ${missing.join(', ')}`);
    }
    expect(failures).toEqual([]);
  });

  it('shows the Student pick once "I\'m a student" is on, so picks change visibly', () => {
    const data = build('2026-11-22');
    const before = computePicks(data, CATALOG, '2026-11-22').ranked.map((p) => p.type);
    const student = { ...data, profile: { ...data.profile, isStudent: true } };
    const after = computePicks(student, CATALOG, '2026-11-22').ranked.map((p) => p.type);
    expect(before).not.toContain('student');
    expect(after).toContain('student');
  });

  it('is slightly under budget with room for a Discover pick', () => {
    const data = build('2026-11-22');
    const total = monthlyTotalPaise(data.subscriptions);
    expect(total).toBeLessThan(data.profile.budgetPaise);
    expect(total / data.profile.budgetPaise).toBeGreaterThan(0.8);
    expect(data.profile.budgetPaise - total).toBeGreaterThanOrEqual(16900); // cheapest Reading plan
  });

  it('has Learning and Reading interests with no active subscription in either', () => {
    const data = build('2026-11-22');
    expect(data.profile.interestScores.Learning).toBeGreaterThanOrEqual(INTEREST_THRESHOLD);
    expect(data.profile.interestScores.Reading).toBeGreaterThanOrEqual(INTEREST_THRESHOLD);
    const active = data.subscriptions.filter((s) => s.status === 'active').map((s) => s.category);
    expect(active).not.toContain('Learning');
    expect(active).not.toContain('Reading');
    expect(data.profile.isStudent).toBe(false);
  });

  it('has history: 6 months of charges, 2 cancellations with savings, ~40 activities', () => {
    const data = build('2026-11-22');
    const months = new Set(data.charges.map((c) => c.date.slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(6);
    expect(data.savings).toHaveLength(2);
    expect(data.subscriptions.filter((s) => s.status === 'cancelled')).toHaveLength(2);
    expect(data.activities.length).toBeGreaterThanOrEqual(35);
  });
});
