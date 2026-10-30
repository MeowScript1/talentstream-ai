import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { fetchMyReports, type MyReports } from '@/services/feed';

/** The candidate's record of flagging fake listings. Points come only from reports other candidates agreed with. */
export function ReportsCard() {
  const [data, setData] = useState<MyReports | null>(null);

  useEffect(() => {
    fetchMyReports().then(setData).catch(() => undefined);
  }, []);

  if (!data) return null;
  const toNext = data.next_rank_at !== null ? data.next_rank_at - data.points : null;

  return (
    <section className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
        <Flag className="h-4 w-4 text-secondary" />
        Scam reports
      </h2>
      <p className="mt-0.5 text-sm text-text-secondary">Reporting a fake listing helps everyone. Rank: <span className="font-semibold text-text-primary">{data.rank}</span></p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Reports sent', value: data.reports_sent },
          { label: 'Confirmed', value: data.confirmed },
          { label: 'Points', value: data.points },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border-subtle bg-bg-elevated px-1 py-2">
            <div className="text-lg font-semibold text-text-primary">{value}</div>
            <div className="text-xs text-text-secondary">{label}</div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-sm text-text-secondary">
        A report is confirmed when {data.reports_needed_to_hide} candidates report the same listing and it is hidden. Each confirmed report earns{' '}
        {data.points_per_confirmed} points.
        {toNext !== null && toNext > 0 && ` ${toNext} more points to the next rank.`}
      </p>
    </section>
  );
}
