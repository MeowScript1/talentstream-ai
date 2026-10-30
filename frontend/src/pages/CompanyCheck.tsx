import { useEffect, useState } from 'react';
import { Building2, Search, ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { searchCompanies, type CompanyResult } from '@/services/feed';

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-elevated px-2 py-2 text-center">
      <div className={`text-lg font-semibold ${tone ?? 'text-text-primary'}`}>{value}</div>
      <div className="text-xs text-text-secondary">{label}</div>
    </div>
  );
}

function CompanyCard({ company }: { company: CompanyResult }) {
  const { listings, on_talentstream: ts } = company;
  const worry = listings && (listings.likely_fake > 0 || listings.reports > 0);

  return (
    <article className="space-y-3 rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
        <Building2 className="h-4 w-4 flex-shrink-0 text-text-secondary" />
        {company.name}
      </h2>

      {listings && (
        <section aria-label="Listings we collected">
          <p className="mb-2 text-sm text-text-secondary">
            {listings.total} {listings.total === 1 ? 'listing' : 'listings'} collected from {listings.sources.join(', ')}. Average trust score{' '}
            <span className="font-semibold text-text-primary">{listings.average_trust}</span>.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Look genuine" value={listings.looks_genuine} tone="text-success" />
            <Stat label="Be careful" value={listings.be_careful} tone={listings.be_careful ? 'text-warning' : undefined} />
            <Stat label="Look fake" value={listings.likely_fake} tone={listings.likely_fake ? 'text-danger' : undefined} />
          </div>
          {worry && (
            <p className="mt-2 rounded-lg border border-warning/30 bg-warning/10 p-2 text-sm text-text-primary">
              {listings.reports > 0
                ? `Candidates have reported listings from this company ${listings.reports} ${listings.reports === 1 ? 'time' : 'times'}. `
                : ''}
              Check each listing's reasons before you share personal details or pay anything.
            </p>
          )}
        </section>
      )}

      {ts && (
        <section aria-label="On TalentStream" className="border-t border-border-subtle pt-3">
          <p className="mb-2 text-sm font-semibold text-text-primary">On TalentStream</p>
          <p className="text-sm text-text-secondary">
            Posted {ts.jobs_posted} {ts.jobs_posted === 1 ? 'job' : 'jobs'} here.
          </p>
          {ts.response_rate !== null ? (
            <p className="mt-1 text-sm text-text-primary">
              <span className="font-semibold">{ts.response_rate}%</span> of applications older than a week got a decision ({ts.decided} of{' '}
              {ts.applications}).
              {ts.median_days_to_decision !== null && <> Typical wait: {ts.median_days_to_decision} days.</>}
            </p>
          ) : (
            <p className="mt-1 text-sm text-text-secondary">
              Not enough history yet to show how this employer responds. We need at least 5 applications that are a week old.
            </p>
          )}
        </section>
      )}
    </article>
  );
}

export default function CompanyCheck() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CompanyResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setError(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(false);
      searchCompanies(q)
        .then((r) => !cancelled && setResults(r))
        .catch(() => !cancelled && setError(true))
        .finally(() => !cancelled && setLoading(false));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-3xl">Company check</h1>
        <p className="mt-1 text-sm text-text-secondary sm:text-base">
          Look a company up before you apply or travel to an interview. Only what we have actually seen is shown.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-secondary" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Company name" className="pl-11" aria-label="Company name" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <p className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-text-primary">Couldn't search just now. Try again in a moment.</p>
      ) : results === null ? (
        <div className="rounded-xl border border-dashed border-border-subtle bg-bg-surface px-6 py-10 text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-secondary" />
          <p className="text-sm text-text-secondary">Type at least 2 letters of a company name.</p>
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle bg-bg-surface px-6 py-10 text-center">
          <p className="font-semibold text-text-primary">Nothing on record for "{query.trim()}"</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-text-secondary">
            That doesn't mean it's safe or unsafe. We only know about companies whose listings we have collected or who post here.
            Never pay to get a job.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((c) => (
            <CompanyCard key={c.name} company={c} />
          ))}
        </div>
      )}
    </div>
  );
}
