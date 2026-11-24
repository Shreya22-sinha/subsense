import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  CHART_COLORS,
  CHART_KEYS,
  CHART_KEY_LABELS,
  chartKey,
  type ChartKey,
} from '@/data/categories';
import type { CategorySlice } from '@/engine/insights';
import { cn } from '@/lib/cn';
import { formatRs } from '@/lib/format';

interface Slice {
  key: ChartKey;
  label: string;
  monthlyPaise: number;
  share: number;
}

/** Fold categories into chart keys (News + Utilities -> "Other"), largest first. */
function toSlices(breakdown: CategorySlice[]): Slice[] {
  const totals = new Map<ChartKey, number>();
  for (const b of breakdown) {
    const k = chartKey(b.category);
    totals.set(k, (totals.get(k) ?? 0) + b.monthlyPaise);
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  return CHART_KEYS.filter((k) => totals.has(k))
    .map((key) => ({
      key,
      label: CHART_KEY_LABELS[key],
      monthlyPaise: totals.get(key) ?? 0,
      share: sum ? (totals.get(key) ?? 0) / sum : 0,
    }))
    .sort((a, b) => b.monthlyPaise - a.monthlyPaise);
}

/**
 * Spend by category (PRD 6.10). Colour follows the category, never its rank. The legend
 * carries names, percentages and amounts (identity is never colour-only) and doubles as the
 * accessible way to filter the timeline.
 */
export function CategoryDonut({
  breakdown,
  theme,
  selected,
  onSelect,
}: {
  breakdown: CategorySlice[];
  theme: 'light' | 'dark';
  selected: ChartKey | null;
  onSelect: (key: ChartKey | null) => void;
}) {
  const slices = useMemo(() => toSlices(breakdown), [breakdown]);
  const colors = CHART_COLORS[theme];
  const surface = theme === 'dark' ? '#1a1824' : '#ffffff';
  const total = slices.reduce((a, s) => a + s.monthlyPaise, 0);

  if (slices.length === 0) {
    return <p className="text-sm text-ink-muted">No active subscriptions in this month.</p>;
  }

  const summary = slices
    .map((s) => `${s.label} ${Math.round(s.share * 100)}% (${formatRs(s.monthlyPaise)})`)
    .join(', ');

  return (
    <div>
      <p className="sr-only">Spend by category per month: {summary}.</p>
      <div className="relative h-48" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="monthlyPaise"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              startAngle={90}
              endAngle={-270}
              stroke={surface}
              strokeWidth={2}
              isAnimationActive={false}
              onClick={(_, index) => {
                const key = slices[index]?.key ?? null;
                onSelect(key === selected ? null : key);
              }}
            >
              {slices.map((s) => (
                <Cell
                  key={s.key}
                  fill={colors[s.key]}
                  opacity={selected && selected !== s.key ? 0.35 : 1}
                  style={{ cursor: 'pointer', outline: 'none' }}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatRs(Number(value)) + '/month'}
              contentStyle={{
                background: theme === 'dark' ? '#252232' : '#ffffff',
                border: `1px solid ${theme === 'dark' ? '#34304a' : '#e3e0ef'}`,
                borderRadius: 12,
                fontSize: 12,
              }}
              itemStyle={{ color: theme === 'dark' ? '#f2f1f7' : '#16141f' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-bold text-ink">{formatRs(total)}</span>
          <span className="text-xs text-ink-muted">per month</span>
        </div>
      </div>

      <ul
        className="mt-3 flex flex-col gap-1"
        aria-label="Categories. Choose one to filter the timeline."
      >
        {slices.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              aria-pressed={selected === s.key}
              onClick={() => onSelect(selected === s.key ? null : s.key)}
              className={cn(
                'flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-surface-2',
                selected === s.key && 'bg-surface-2',
              )}
            >
              <span
                className="size-3 shrink-0 rounded-sm"
                style={{ background: colors[s.key] }}
                aria-hidden
              />
              <span className="flex-1 font-medium text-ink">{s.label}</span>
              <span className="text-ink-muted">{Math.round(s.share * 100)}%</span>
              <span className="w-20 text-right font-semibold text-ink">
                {formatRs(s.monthlyPaise)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
