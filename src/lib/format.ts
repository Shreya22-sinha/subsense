import { format as formatDateFns, parseISO } from 'date-fns';
import type { IsoDate, Paise } from '@/types/models';

const rupeeFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Paise -> "₹1,23,456" (Indian digit grouping, no decimals). */
export function formatRs(paise: Paise): string {
  return rupeeFormatter.format(Math.round(paise / 100));
}

/** Whole rupees (number input) -> paise. */
export function rupeesToPaise(rupees: number): Paise {
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: Paise): number {
  return Math.round(paise / 100);
}

/** "2026-11-21" -> "21 Nov 2026". */
export function formatDate(date: IsoDate): string {
  return formatDateFns(parseISO(date), 'd MMM yyyy');
}

/** "2026-11-21" -> "Saturday, 21 Nov". */
export function formatLongDay(date: IsoDate): string {
  return formatDateFns(parseISO(date), 'EEEE, d MMM');
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
