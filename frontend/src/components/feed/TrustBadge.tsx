import { useState } from 'react';
import { ChevronDown, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrustLabel, TrustReason } from '@/types/feed';

const STYLES: Record<TrustLabel, { label: string; icon: typeof ShieldCheck; chip: string }> = {
  looks_good: { label: 'Looks genuine', icon: ShieldCheck, chip: 'border-success/40 bg-success/10 text-success' },
  be_careful: { label: 'Be careful', icon: ShieldAlert, chip: 'border-warning/40 bg-warning/10 text-warning' },
  likely_scam: { label: 'Likely fake', icon: ShieldX, chip: 'border-danger/40 bg-danger/10 text-danger' },
};

interface TrustBadgeProps {
  label: TrustLabel;
  score: number;
  reasons: TrustReason[];
}

/** The rating chip plus an expandable "why": every point comes from a rule the candidate can read. */
export function TrustBadge({ label, score, reasons }: TrustBadgeProps) {
  const [open, setOpen] = useState(false);
  const style = STYLES[label];
  const Icon = style.icon;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold', style.chip)}
      >
        <Icon className="h-3.5 w-3.5" />
        {style.label}
        <span className="opacity-70">· {score}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="mb-2 text-xs text-text-muted">
            Why this rating? An automatic check of the listing. It can miss things, so always verify before sharing
            personal details or paying anything.
          </p>
          <ul className="space-y-1">
            {reasons.map((r) => (
              <li key={r.code} className="flex items-start gap-2 text-xs">
                <span className={cn('mt-0.5 w-8 flex-shrink-0 font-bold tabular-nums', r.impact < 0 ? 'text-danger' : 'text-success')}>
                  {r.impact > 0 ? `+${r.impact}` : r.impact}
                </span>
                <span className="text-text-secondary">{r.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
