import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarPlus, ExternalLink, Flag, Globe, MapPin, Navigation, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { downloadWalkinCalendar } from '@/lib/calendar';
import { describeWalkinDate, timeAgo } from '@/lib/dates';
import { getApiError } from '@/lib/utils';
import { reportFeedJob } from '@/services/feed';
import { useAuthStore } from '@/store/authStore';
import type { FeedJob } from '@/types/feed';
import { TrustBadge } from './TrustBadge';

interface FeedJobCardProps {
  job: FeedJob;
  onReported?: (jobId: string, hidden: boolean) => void;
}

export function FeedJobCard({ job, onReported }: FeedJobCardProps) {
  const user = useAuthStore((s) => s.user);
  const [reported, setReported] = useState(false);
  const walkin = job.kind === 'walkin' && job.walkin_date ? describeWalkinDate(job.walkin_date) : null;
  const lastDay = job.walkin_end_date ? describeWalkinDate(job.walkin_end_date) : null;
  // What to carry, one item per line, from the free-text note
  const bring = (job.notes ?? '')
    .split(/[\n;]+|\.\s+/)
    .map((t) => t.trim().replace(/\.$/, ''))
    .filter(Boolean);
  // The worst-scoring checks, shown up front on listings that are not clearly fine
  const warnings =
    job.trust_label === 'looks_good'
      ? []
      : [...job.trust_reasons].filter((r) => r.impact < 0).sort((a, b) => a.impact - b.impact).slice(0, 2);
  const mapsUrl = job.venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.venue)}` : null;

  const handleReport = async () => {
    if (!confirm('Report this job as fake or misleading? Enough reports hide it for everyone.')) return;
    try {
      const res = await reportFeedJob(job.id);
      setReported(true);
      toast.success('Thanks, we recorded your report');
      onReported?.(job.id, res.hidden);
    } catch (error) {
      toast.error(getApiError(error, 'Could not send your report'));
    }
  };

  return (
    <article className="rounded-xl border border-border-subtle bg-bg-surface shadow-sm p-4 shadow-card  sm:p-5">
      <div className="flex gap-4">
        {walkin && (
          <div className="flex h-16 w-14 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-accent-primary text-on-accent ">
            <span className="text-xs font-bold uppercase leading-none">{walkin.weekday}</span>
            <span className="font-display text-2xl font-semibold leading-none">{walkin.day}</span>
            <span className="text-xs font-bold uppercase leading-none">{walkin.month}</span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <h3 className="min-w-0 text-base font-bold leading-snug text-text-primary">{job.title}</h3>
            <span className="flex-shrink-0 text-xs text-text-muted">{walkin?.relative || timeAgo(job.posted_at)}</span>
          </div>
          <p className="mt-0.5 text-sm text-text-secondary">
            {job.company || 'Company not listed'}
            {job.location && !job.remote && (
              <span className="inline-flex items-center gap-1 text-text-muted">
                {' · '}
                <MapPin className="h-3 w-3" />
                {job.location}
              </span>
            )}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            {job.remote && (
              <span className="inline-flex items-center gap-1 rounded-md bg-cyan/10 px-2 py-0.5 font-bold text-cyan">
                <Globe className="h-3 w-3" /> Remote
              </span>
            )}
            {job.salary_text && (
              <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-0.5 font-bold text-success">
                <Wallet className="h-3 w-3" /> {job.salary_text}
              </span>
            )}
            {job.native ? (
              <span className="rounded-md border border-accent-primary/40 bg-accent-muted px-2 py-0.5 font-bold text-accent-primary">
                Posted on TalentStream
              </span>
            ) : (
              <span className="rounded-md border border-white/10 px-2 py-0.5 text-text-muted">via {job.source_label}</span>
            )}
          </div>
        </div>
      </div>

      {walkin && (job.walkin_time || job.venue || job.notes) && (
        <div className="mt-3 rounded-lg border border-border-subtle bg-bg-elevated p-3 text-sm">
          {(walkin.relative || job.walkin_time) && (
            <p className="font-semibold text-text-primary">
              {[walkin.relative, job.walkin_time].filter(Boolean).join(', ')}
              {lastDay && <span className="font-normal text-text-secondary"> (runs until {lastDay.weekday} {lastDay.day} {lastDay.month})</span>}
            </p>
          )}
          {job.venue && (
            <p className="mt-1 flex items-start gap-1.5 text-text-primary">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0" />
              {job.venue}
            </p>
          )}
          {bring.length > 0 && (
            <div className="mt-2 border-t border-border-subtle pt-2">
              <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">Bring</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-text-primary">
                {bring.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <div
          className={`mt-3 flex gap-2 rounded-lg border p-3 text-sm ${
            job.trust_label === 'likely_scam' ? 'border-danger/50 bg-danger/10 text-danger' : 'border-warning/50 bg-warning/10 text-warning'
          }`}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">{job.trust_label === 'likely_scam' ? 'Likely fake' : 'Be careful'}</p>
            <ul className="mt-0.5 space-y-0.5 text-text-primary">
              {warnings.map((r) => (
                <li key={r.code}>{r.text}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {job.snippet && <p className="mt-3 line-clamp-3 text-sm text-text-secondary">{job.snippet}</p>}

      {job.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="rounded-lg bg-bg-elevated px-2 py-0.5 text-xs text-text-secondary">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-white/[0.07] pt-3">
        <TrustBadge label={job.trust_label} score={job.trust_score} reasons={job.trust_reasons} />

        <div className="flex flex-wrap items-center gap-2 [&_button]:whitespace-nowrap">
          {user ? (
            <button
              type="button"
              onClick={handleReport}
              disabled={reported}
              className="inline-flex items-center gap-1 px-1 py-3 text-xs text-text-muted hover:text-danger disabled:opacity-50 md:py-1"
            >
              <Flag className="h-3.5 w-3.5" /> {reported ? 'Reported' : 'Report'}
            </button>
          ) : (
            <Link to="/login" className="px-1 py-3 text-xs text-text-muted hover:text-text-primary md:py-1">
              Log in to report
            </Link>
          )}
          {job.native ? (
            <>
              {job.walkin_start_time && (
                <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => downloadWalkinCalendar(job)}>
                  <CalendarPlus className="h-3.5 w-3.5" /> Add to calendar
                </Button>
              )}
              <a href={job.url} target="_blank" rel="noopener noreferrer">
                <Button type="button" size="sm" className="gap-1.5">
                  <Navigation className="h-3.5 w-3.5" /> Get directions
                </Button>
              </a>
            </>
          ) : (
          <>
          {walkin && mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" size="sm" variant="ghost" className="gap-1.5">
                <Navigation className="h-3.5 w-3.5" /> Get directions
              </Button>
            </a>
          )}
          {/* A normal followed link to the source, as the sources' terms require */}
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            {job.trust_label === 'likely_scam' ? (
              // Don't invite people to apply to something that looks fake
              <Button type="button" size="sm" variant="outline" className="gap-1.5 border-danger/40 text-danger">
                Open anyway <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button type="button" size="sm" className="gap-1.5">
                {walkin ? 'See details' : 'Apply'} on {job.source_label} <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            )}
          </a>
          </>
          )}
        </div>
      </div>
    </article>
  );
}
