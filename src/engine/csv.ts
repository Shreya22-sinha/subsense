/** CSV export (PRD 8, "CSV export columns"). Pure: returns the file name and text. */
import type { IsoDate, Subscription, Usage } from '@/types/models';
import { monthlyEquivalentPaise, monthlyShareOf, sharePaise } from './dates';
import { uses30ById } from './usage';

export const CSV_COLUMNS = [
  'name',
  'plan',
  'category',
  'price_rs',
  'cycle',
  'monthly_equivalent_rs',
  'your_share_rs',
  'start_date',
  'next_charge',
  'trial_end',
  'end_date',
  'status',
  'auto_renew',
  'usage_rating',
  'uses_last_30_days',
  'liking',
  'paid_with',
  'notes',
] as const;

/** UTF-8 byte order mark so Excel reads ₹ and other characters correctly. */
export const BOM = '﻿';

/** Every value is quoted; inner quotes are doubled. Leading =+-@ are neutralised for spreadsheets. */
export function csvCell(value: string | number | boolean | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Rupees with up to 2 decimals, no grouping (spreadsheet-friendly). */
const rs = (paise: number) => (Math.round(paise) / 100).toString();

export function subscriptionsCsv(subs: Subscription[], usages: Usage[], today: IsoDate): string {
  const uses = uses30ById(usages, today);
  const rows = subs.map((s) => [
    s.name,
    s.planName,
    s.category,
    rs(s.pricePaise),
    s.cycle,
    rs(monthlyEquivalentPaise(s.pricePaise, s.cycle)),
    rs(s.cycle === 'one_time' ? sharePaise(s.pricePaise, s.sharedWith) : monthlyShareOf(s)),
    s.startDate,
    s.nextChargeDate ?? '',
    s.trialEndDate ?? '',
    s.endDate ?? '',
    s.status,
    s.autoRenew ? 'yes' : 'no',
    s.usageRating,
    uses.get(s.id) ?? 0,
    s.liking ?? '',
    s.paidWith,
    s.notes,
  ]);
  const lines = [CSV_COLUMNS, ...rows].map((r) => r.map(csvCell).join(','));
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvFileName(today: IsoDate): string {
  return `subsense_subscriptions_${today}.csv`;
}
