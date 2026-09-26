import { formatINR } from '@/domain/money';

/**
 * Shared Recharts styling.
 *
 * The palette and axis treatment are defined once so every chart in the app looks
 * like part of the same product, and money is always formatted through the money
 * domain helpers (never with a raw `toFixed`).
 */

export const CHART_COLORS = {
  accent: '#9AE6B4',
  accentSoft: 'rgba(154, 230, 180, 0.18)',
  grid: '#25282D',
  axis: '#6C737D',
  axisText: '#9BA1AA',
  surface: '#141619',
} as const;

export const AXIS_PROPS = {
  stroke: CHART_COLORS.axis,
  tick: { fill: CHART_COLORS.axisText, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: CHART_COLORS.grid },
} as const;

export function compactPaiseTick(value: number): string {
  return formatINR(value, { compact: true, decimals: 0 });
}

export type TooltipEntry = {
  name?: string;
  dataKey?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
};

export type ChartTooltipProps = {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  /** Optional footer line, e.g. the day's expense count. */
  footer?: (entries: TooltipEntry[]) => string | null;
  /** Format numbers as money (default) or as plain counts. */
  format?: 'money' | 'count';
};

/** Dark, compact tooltip used by every chart. */
export function ChartTooltip({ active, payload, label, footer, format = 'money' }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const footerText = footer ? footer(payload) : null;

  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 shadow-pop">
      {label !== undefined ? (
        <p className="mb-1 text-2xs font-medium text-content-muted">{String(label)}</p>
      ) : null}
      <ul className="space-y-0.5">
        {payload.map((entry, index) => {
          const raw = typeof entry.value === 'number' ? entry.value : Number(entry.value ?? 0);
          return (
            <li
              key={`${entry.dataKey ?? index}`}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="flex items-center gap-1.5 text-content-muted">
                {entry.color ? (
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                ) : null}
                {entry.name ?? ''}
              </span>
              <span className="num font-medium text-content">
                {format === 'money' ? formatINR(raw) : raw.toLocaleString('en-IN')}
              </span>
            </li>
          );
        })}
      </ul>
      {footerText ? <p className="mt-1 text-2xs text-content-subtle">{footerText}</p> : null}
    </div>
  );
}
