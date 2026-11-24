import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { monthLabel, monthShort, type MonthSpend } from '@/engine/insights';
import { formatRs } from '@/lib/format';

const BAR = { light: '#6c4cf1', dark: '#9b85ff' };

/**
 * 6-month trend (PRD 6.10). One series (monthly spend) in the brand hue; the current
 * month's still-scheduled part is the same hue with a 45° stripe, stacked on top.
 */
export function TrendBars({ trend, theme }: { trend: MonthSpend[]; theme: 'light' | 'dark' }) {
  const color = BAR[theme];
  const ink = theme === 'dark' ? '#aeaac2' : '#5b5870';
  const grid = theme === 'dark' ? '#34304a' : '#e3e0ef';
  const data = trend.map((t) => ({
    label: monthShort(t.month),
    month: t.month,
    spent: t.spent / 100,
    projected: t.projected / 100,
  }));
  const hasProjection = trend.some((t) => t.projected > 0);

  const summary = trend
    .map(
      (t) =>
        `${monthLabel(t.month)} ${formatRs(t.spent)}${t.projected ? ` plus ${formatRs(t.projected)} scheduled` : ''}`,
    )
    .join('; ');

  return (
    <div>
      <p className="sr-only">Monthly spend for the last 6 months: {summary}.</p>
      <div className="h-44" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 4, bottom: 0, left: -8 }}
            barCategoryGap="28%"
          >
            <defs>
              <pattern
                id="stripe"
                width="6"
                height="6"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="6" fill={color} opacity={0.25} />
                <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth="2.5" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke={grid} strokeDasharray="0" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: ink, fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: ink, fontSize: 11 }}
              tickFormatter={(v: number) => (v >= 1000 ? `₹${Math.round(v / 100) / 10}k` : `₹${v}`)}
            />
            <Tooltip
              cursor={{ fill: grid, opacity: 0.4 }}
              formatter={(value, name) => [
                formatRs(Number(value) * 100),
                name === 'projected' ? 'Scheduled' : 'Charged',
              ]}
              labelFormatter={(_, payload) => {
                const m = payload?.[0]?.payload?.month as string | undefined;
                return m ? monthLabel(m) : '';
              }}
              contentStyle={{
                background: theme === 'dark' ? '#252232' : '#ffffff',
                border: `1px solid ${grid}`,
                borderRadius: 12,
                fontSize: 12,
              }}
              itemStyle={{ color: theme === 'dark' ? '#f2f1f7' : '#16141f' }}
              labelStyle={{ color: ink }}
            />
            <Bar
              dataKey="spent"
              stackId="m"
              fill={color}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="projected"
              stackId="m"
              fill="url(#stripe)"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-ink-muted" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm" style={{ background: color }} /> Charged
        </span>
        {hasProjection && (
          <span className="flex items-center gap-1.5">
            <svg width="12" height="12" className="rounded-sm">
              <rect width="12" height="12" fill="url(#stripe)" />
            </svg>
            Scheduled this month
          </span>
        )}
      </div>
    </div>
  );
}
