import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AXIS_PROPS, CHART_COLORS, ChartTooltip, compactPaiseTick } from '@/components/charts/chart-primitives';
import { formatINR } from '@/domain/money';
import type { CategoryTotalWithShare } from '@/domain/analytics';

/**
 * Category comparison as horizontal bars.
 *
 * Horizontal (not vertical) so long Indian category names stay readable without
 * rotating labels, which is the usual failure mode of category charts on phones.
 */
export function CategoryBarChart({
  categories,
  height,
}: {
  categories: CategoryTotalWithShare[];
  height?: number;
}) {
  const data = categories
    .filter((row) => row.total_paise > 0)
    .map((row) => ({
      name: row.category_name,
      total_paise: row.total_paise,
      color: row.category_color,
      share_percent: row.share_percent,
      expense_count: row.expense_count,
    }));

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-xs text-content-subtle">
        No spending recorded for this period yet.
      </p>
    );
  }

  return (
    <div style={{ width: '100%', height: height ?? Math.max(data.length * 36 + 24, 160) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
          <XAxis type="number" tickFormatter={compactPaiseTick} {...AXIS_PROPS} />
          <YAxis
            type="category"
            dataKey="name"
            width={116}
            tick={{ fill: CHART_COLORS.axisText, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: CHART_COLORS.grid }}
          />
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
                  const count = `${point.expense_count ?? 0} expenses`;
                  return [share, count].filter(Boolean).join(' · ');
                }}
              />
            }
          />
          <Bar dataKey="total_paise" name="Spent" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tiny inline legend showing category colour, name, amount and share. */
export function CategoryLegend({
  categories,
  limit = 6,
}: {
  categories: CategoryTotalWithShare[];
  limit?: number;
}) {
  const rows = categories.filter((row) => row.total_paise > 0).slice(0, limit);
  if (rows.length === 0) return null;

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.category_id ?? row.category_name} className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: row.category_color }}
          />
          <span className="min-w-0 flex-1 truncate text-xs text-content">{row.category_name}</span>
          <span className="num shrink-0 text-xs font-medium text-content">{formatINR(row.total_paise)}</span>
          <span className="num w-12 shrink-0 text-right text-2xs text-content-subtle">
            {row.share_percent === null ? '—' : `${row.share_percent}%`}
          </span>
        </li>
      ))}
    </ul>
  );
}
