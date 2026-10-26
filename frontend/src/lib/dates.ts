const DAY_MS = 24 * 60 * 60 * 1000;

export function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** "2026-10-28" -> { day: '28', month: 'Oct', weekday: 'Wed', relative: 'in 2 days' } (local calendar days, no timezone drift) */
export function describeWalkinDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / DAY_MS);
  const relative = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff > 1 ? `In ${diff} days` : '';
  return {
    day: String(d),
    month: date.toLocaleDateString(undefined, { month: 'short' }),
    weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
    relative,
  };
}
