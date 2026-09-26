import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AXIS_PROPS,
  CHART_COLORS,
  ChartTooltip,
  compactPaiseTick,
} from '@/components/charts/chart-primitives';
import { shareOfTotal } from '@/domain/money';
import type { MemberTotal } from '@/types/domain';

/** Member comparison as a vertical bar chart (few members, long names fit below). */
export function MemberBarChart({ members, height = 220 }: { members: MemberTotal[]; height?: number }) {
  const total = members.reduce((sum, row) => sum + row.total_paise, 0);
  const data = members.map((row) => ({
    name: row.display_name.split(' ')[0],
    full_name: row.display_name,
    total_paise: row.total_paise,
    share_percent: shareOfTotal(row.total_paise, total),
    expense_count: row.expense_count,
  }));

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-content-subtle">No family members yet.</p>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis dataKey="name" {...AXIS_PROPS} />
          <YAxis width={64} tickFormatter={compactPaiseTick} {...AXIS_PROPS} />
          <Tooltip
            cursor={{ fill: 'rgba(154, 230, 180, 0.06)' }}
            content={
              <ChartTooltip
                footer={(entries) => {
                  const point = entries[0]?.payload as
                    | { share_percent?: number | null; expense_count?: number }
                    | undefined;
                  if (!point) return null;
                  const share =
                    typeof point.share_percent === 'number' ? `${point.share_percent}% of total` : null;
                  return [share, `${point.expense_count ?? 0} expenses`].filter(Boolean).join(' · ');
                }}
              />
            }
          />
          <Bar
            dataKey="total_paise"
            name="Spent"
            fill={CHART_COLORS.accent}
            fillOpacity={0.85}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
