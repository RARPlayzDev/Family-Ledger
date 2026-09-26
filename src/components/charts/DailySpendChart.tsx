import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS_PROPS, CHART_COLORS, ChartTooltip, compactPaiseTick } from '@/components/charts/chart-primitives';
import { formatINR } from '@/domain/money';
import { buildCumulativeSeries } from '@/domain/analytics';
import type { DailyTotal } from '@/types/domain';

/**
 * Daily spend for the selected month.
 *
 * A zero-filled series is plotted (see buildDailySeries), so a quiet day shows as
 * a real zero instead of silently shifting the x-axis and hiding gaps in spending.
 */
export function DailySpendChart({
  dailyTotals,
  height = 220,
}: {
  dailyTotals: DailyTotal[];
  height?: number;
}) {
  const series = useMemo(() => buildCumulativeSeries(dailyTotals), [dailyTotals]);

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="familyledger-daily" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS.accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART_COLORS.accent} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={16} {...AXIS_PROPS} />
          <YAxis width={64} tickFormatter={compactPaiseTick} {...AXIS_PROPS} />
          <Tooltip
            content={
              <ChartTooltip
                footer={(entries) => {
                  const point = entries[0]?.payload as { cumulative_paise?: number } | undefined;
                  const count = entries[0]?.payload as { expense_count?: number } | undefined;
                  if (!point) return null;
                  const cumulative = point.cumulative_paise ?? 0;
                  const expenses = count?.expense_count ?? 0;
                  return `Month to date: ${formatINR(cumulative)} · ${expenses} expense${
                    expenses === 1 ? '' : 's'
                  }`;
                }}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="total_paise"
            name="Spent that day"
            stroke={CHART_COLORS.accent}
            strokeWidth={2}
            fill="url(#familyledger-daily)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
