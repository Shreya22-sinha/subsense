import type { Category } from '@/types/models';

/**
 * Category colours. One hue per category, used in two steps:
 * - CHART: the validated 8-slot categorical palette (dataviz validator: lightness, chroma,
 *   CVD and normal-vision separation all pass in light and dark). Assigned in fixed order,
 *   never by rank. Categories 9 and 10 (News, Utilities) fold into a neutral "Other".
 * - INITIAL: a darker step of the same hue, so white initials meet 4.5:1 contrast.
 * Never brand colours (PRD 9.1).
 */

export type ChartKey = Exclude<Category, 'News' | 'Utilities'> | 'Other';

/** Fixed slot order. */
export const CHART_KEYS: ChartKey[] = [
  'Video',
  'Music',
  'Cloud',
  'Fitness',
  'Reading',
  'Learning',
  'Productivity',
  'Gaming',
  'Other',
];

export const CHART_COLORS: Record<'light' | 'dark', Record<ChartKey, string>> = {
  light: {
    Video: '#2a78d6',
    Music: '#eb6834',
    Cloud: '#1baf7a',
    Fitness: '#eda100',
    Reading: '#e87ba4',
    Learning: '#008300',
    Productivity: '#6250d6',
    Gaming: '#e34948',
    Other: '#8b8a86',
  },
  dark: {
    Video: '#3987e5',
    Music: '#d95926',
    Cloud: '#199e70',
    Fitness: '#c98500',
    Reading: '#d55181',
    Learning: '#0ca30c',
    Productivity: '#9085e9',
    Gaming: '#e66767',
    Other: '#77756f',
  },
};

export function chartKey(category: Category): ChartKey {
  return category === 'News' || category === 'Utilities' ? 'Other' : category;
}

export const CHART_KEY_LABELS: Record<ChartKey, string> = {
  Video: 'Video',
  Music: 'Music',
  Cloud: 'Cloud',
  Fitness: 'Fitness',
  Reading: 'Reading',
  Learning: 'Learning',
  Productivity: 'Productivity',
  Gaming: 'Gaming',
  Other: 'Bills and news',
};

/** Initial circles: darker step of each category's chart hue (white text >= 4.5:1). */
export const CATEGORY_COLORS: Record<Category, string> = {
  Video: '#1c5cab',
  Music: '#c2410c',
  Cloud: '#0f766e',
  Fitness: '#a16207',
  Reading: '#be185d',
  Learning: '#15803d',
  Productivity: '#5b44c7',
  Gaming: '#b91c1c',
  News: '#475569',
  Utilities: '#57534e',
};
