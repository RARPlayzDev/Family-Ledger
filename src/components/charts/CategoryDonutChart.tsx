import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_COLORS, ChartTooltip } from '@/components/charts/chart-primitives';
import type { CategoryTotalWithShare } from '@/domain/analytics';

/**
 * Category donut for the analytics page.
 * Capped at six slices plus "Other" so the ring never becomes unreadable.
 */
export function CategoryDonutChart({
  categories,
  height = 220,
}: {
  categories: CategoryTotalWithShare[];
  height?: number;
}) {
  const topped = categories.filter((row) => row.total_paise > 0);
  if (topped.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-content-subtle">
        Nothing to chart for this period yet.
      </p>
    );
  }

  const visible = topped.slice(0, 6);
  const rest = topped.slice(6);
  const restTotal = rest.reduce((sum, row) => sum + row.total_paise, 0);

  const data = [
    ...visible.map((row) => ({
      name: row.category_name,
      value: row.total_paise,
      color: row.category_color,
      share_percent: row.share_percent,
      expense_count: row.expense_count,
    })),
    ...(restTotal > 0
      ? [
          {
            name: `Other (${rest.length})`,
            value: restTotal,
            color: CHART_COLORS.axis,
            share_percent: null,
            expense_count: rest.reduce((sum, row) => sum + row.expense_count, 0),
          },
        ]
      : []),
  ];

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="86%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} fillOpacity={0.9} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
