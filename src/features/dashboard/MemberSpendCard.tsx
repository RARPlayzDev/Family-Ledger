import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Money } from '@/components/shared/money';
import { formatPercent, shareOfTotal } from '@/domain/money';
import type { MemberTotal } from '@/types/domain';

/**
 * Who spent what.
 *
 * Shows every member (including those with zero spend) so the split of the
 * household's month is visible at a glance, with the share relative to the largest
 * spender rather than to the total (bars stay comparable across months).
 */
export function MemberSpendCard({
  memberTotals,
  limit,
}: {
  memberTotals: MemberTotal[];
  limit?: number;
}) {
  const rows = memberTotals.slice(0, limit ?? memberTotals.length);
  const total = memberTotals.reduce((sum, row) => sum + row.total_paise, 0);
  const largest = memberTotals.reduce((max, row) => Math.max(max, row.total_paise), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending by member</CardTitle>
        <Link to="/app/members" className="text-2xs text-accent hover:underline">
          View family
        </Link>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-xs text-content-subtle">No family members yet.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const width = largest > 0 ? Math.round((row.total_paise / largest) * 100) : 0;
              const share = shareOfTotal(row.total_paise, total);
              return (
                <li key={row.user_id} className="flex items-center gap-3">
                  <Avatar name={row.display_name} src={row.avatar_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link
                        to={`/app/members/${row.user_id}`}
                        className="truncate text-xs font-medium text-content hover:text-accent"
                      >
                        {row.display_name}
                        {row.role === 'owner' ? (
                          <span className="ml-1.5 text-2xs text-accent">owner</span>
                        ) : null}
                      </Link>
                      <Money paise={row.total_paise} className="text-xs font-semibold text-content" />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                        <div
                          className="h-full rounded-full bg-accent/70"
                          style={{ width: `${Math.max(width, row.total_paise > 0 ? 3 : 0)}%` }}
                        />
                      </div>
                      <span className="num w-12 shrink-0 text-right text-2xs text-content-subtle">
                        {formatPercent(share, 1)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
