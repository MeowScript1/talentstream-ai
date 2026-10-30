import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Briefcase, Loader2, MapPin, Search, ShieldCheck, Wifi, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import { addAlert, fetchAlerts, fetchNewDrives, markAlertsSeen, removeAlert, type NewDrives, type WalkinAlert } from '@/services/alerts';
import { fetchFeed, fetchFeedStats, type FeedStats } from '@/services/feed';
import type { FeedJob, FeedKind, FeedPage } from '@/types/feed';
import { FeedJobCard } from './FeedJobCard';

const PAGE_SIZE = 15;
const CITIES = ['Bengaluru', 'Hyderabad', 'Mumbai', 'Delhi', 'Pune', 'Chennai', 'Kolkata', 'Gurugram'];

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

interface TabProps {
  active: boolean;
  onClick: () => void;
  icon: typeof Briefcase;
  label: ReactNode;
  count?: number;
}

function Tab({ active, onClick, icon: Icon, label, count }: TabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 text-sm font-bold transition-all sm:gap-2 sm:px-4',
        active ? 'bg-bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      {count !== undefined && (
        <span className={cn('rounded-md px-1.5 text-xs font-semibold', active ? 'bg-secondary-container text-on-secondary-container' : 'bg-white/10')}>{count}</span>
      )}
    </button>
  );
}

/** Jobs collected from other platforms: "Apply online" and "Walk-in (next 7 days)", each with its own tab. */
export function FeedExplorer({ initialKind = 'apply' }: { initialKind?: FeedKind }) {
  const [kind, setKind] = useState<FeedKind>(initialKind);
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [includeRisky, setIncludeRisky] = useState(false);
  const debouncedQuery = useDebounced(query, 350);
  const debouncedPlace = useDebounced(place, 350);

  const [items, setItems] = useState<FeedJob[]>([]);
  const [meta, setMeta] = useState<Omit<FeedPage, 'items'> | null>(null);
  const [stats, setStats] = useState<FeedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const latest = useRef(0); // ignore responses from searches that were replaced

  // Walk-in alerts: cities the candidate follows, and drives that appeared since they last looked
  const [alerts, setAlerts] = useState<WalkinAlert[]>([]);
  const [newDrives, setNewDrives] = useState<NewDrives | null>(null);
  useEffect(() => {
    fetchAlerts().then(setAlerts).catch(() => undefined);
    fetchNewDrives().then(setNewDrives).catch(() => undefined);
  }, []);

  const seeNewDrives = () => {
    const first = newDrives?.cities[0]?.city;
    setKind('walkin');
    if (first) setPlace(first);
    setNewDrives(null);
    markAlertsSeen().catch(() => undefined);
  };
  const dismissNewDrives = () => {
    setNewDrives(null);
    markAlertsSeen().catch(() => undefined);
  };
  const followCity = async (city: string) => {
    try {
      setAlerts(await addAlert(city));
      toast.success(`Following walk-ins in ${city}`);
    } catch {
      toast.error('Could not follow this city. You can follow up to 5.');
    }
  };
  const unfollowCity = async (alert: WalkinAlert) => {
    try {
      await removeAlert(alert.id);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    } catch {
      toast.error('Could not remove this alert');
    }
  };
  const followingPlace = alerts.some((a) => a.city.toLowerCase() === place.trim().toLowerCase());

  const load = useCallback(
    async (page: number) => {
      const id = ++latest.current;
      if (page === 1) setLoading(true);
      else setLoadingMore(true);
      setError(false);
      try {
        const data = await fetchFeed({
          kind,
          q: debouncedQuery,
          location: debouncedPlace,
          remote: kind === 'apply' && remoteOnly ? true : undefined,
          include_risky: includeRisky,
          page,
          limit: PAGE_SIZE,
        });
        if (id !== latest.current) return;
        const { items: fresh, ...rest } = data;
        setItems((prev) => (page === 1 ? fresh : [...prev, ...fresh]));
        setMeta(rest);
      } catch {
        if (id === latest.current) setError(true);
      } finally {
        if (id === latest.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [kind, debouncedQuery, debouncedPlace, remoteOnly, includeRisky]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  useEffect(() => {
    fetchFeedStats().then(setStats).catch(() => undefined);
  }, []);

  // The very first visit starts collecting jobs in the background: check again shortly
  useEffect(() => {
    if (meta?.syncing && items.length === 0) {
      const t = setTimeout(() => load(1), 6000);
      return () => clearTimeout(t);
    }
  }, [meta?.syncing, items.length, load]);

  const handleReported = (jobId: string, hidden: boolean) => {
    if (hidden) setItems((prev) => prev.filter((j) => j.id !== jobId));
  };

  const hasIndiaSource = meta?.sources.some((s) => s.name === 'adzuna' || s.name === 'jooble') ?? false;
  const canLoadMore = meta !== null && items.length < meta.total;

  return (
    <div className="space-y-4">
      {newDrives && newDrives.total_new > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm">
          <Bell className="h-4 w-4 flex-shrink-0 text-success" />
          <span className="min-w-0 flex-1 text-text-primary">
            <span className="font-semibold">
              {newDrives.total_new} new walk-in {newDrives.total_new === 1 ? 'drive' : 'drives'}
            </span>{' '}
            in {newDrives.cities.map((c) => c.city).join(', ')} since you last looked.
          </span>
          <button type="button" onClick={seeNewDrives} className="py-2 font-bold text-accent-primary hover:underline md:py-0">
            See them
          </button>
          <button type="button" onClick={dismissNewDrives} className="py-2 text-text-secondary hover:underline md:py-0">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-1 rounded-lg border border-border-subtle bg-bg-elevated p-1">
        <Tab active={kind === 'apply'} onClick={() => setKind('apply')} icon={Briefcase} label="Apply online" count={stats?.apply_jobs} />
        <Tab
          active={kind === 'walkin'}
          onClick={() => setKind('walkin')}
          icon={MapPin}
          label={
            <>
              <span className="sm:hidden">Walk-in · 7d</span>
              <span className="hidden sm:inline">Walk-in · 7 days</span>
            </>
          }
          count={stats?.walkin_jobs_next_7_days}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_14rem]">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search jobs" className="pl-11" />
          </div>
          {/* Phones pick a city from a short list; wider screens type one and use the buttons below */}
          <div className="relative w-32 shrink-0 sm:hidden">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <select
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              aria-label="City"
              className="h-12 w-full appearance-none rounded-md border border-white/10 bg-white/[0.04] pl-9 pr-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
            >
              <option value="">All cities</option>
              {place.trim() && !CITIES.some((c) => c.toLowerCase() === place.trim().toLowerCase()) && (
                <option value={place}>{place}</option>
              )}
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="relative hidden sm:block">
          <MapPin className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="City or country" className="pl-11" />
        </div>
      </div>

      <div className="hidden flex-wrap gap-2 sm:flex" aria-label="Popular cities">
        {CITIES.map((city) => {
          const on = place.trim().toLowerCase() === city.toLowerCase();
          return (
            <button
              key={city}
              type="button"
              onClick={() => setPlace(on ? '' : city)}
              aria-pressed={on}
              className={cn(
                'inline-flex items-center rounded-md border px-3 text-sm font-medium transition-colors md:py-1',
                on ? 'border-accent-primary bg-accent-primary text-on-accent' : 'border-border-subtle bg-bg-surface text-text-secondary hover:text-text-primary'
              )}
            >
              {city}
            </button>
          );
        })}
      </div>

      {kind === 'walkin' && (
        <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-surface p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Bell className="h-4 w-4 flex-shrink-0 text-secondary" />
            <span className="min-w-0 flex-1 font-semibold text-text-primary">Walk-in alerts</span>
            {place.trim() && !followingPlace && (
              <button
                type="button"
                onClick={() => followCity(place.trim())}
                className="min-h-10 rounded-md border border-border-subtle px-3 font-semibold text-text-primary hover:border-border-active"
              >
                Follow {place.trim()}
              </button>
            )}
          </div>
          {alerts.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Cities you follow">
              {alerts.map((a) => (
                <li key={a.id} className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-bg-elevated py-1 pl-3 pr-1 text-text-primary">
                  {a.city}
                  <button type="button" onClick={() => unfollowCity(a)} aria-label={`Stop following ${a.city}`} className="flex h-8 w-8 items-center justify-center rounded text-text-secondary hover:text-danger">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-text-secondary">
            {alerts.length === 0 && !place.trim()
              ? 'Pick a city above, then follow it to hear about new drives there. '
              : ''}
            New drives show up here when you open TalentStream. We don't send emails or notifications yet.
          </p>
        </div>
      )}

      {kind === 'apply' && (
        <div>
          <button
            type="button"
            onClick={() => setRemoteOnly((v) => !v)}
            aria-pressed={remoteOnly}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-4 text-sm font-medium transition-colors md:min-h-0 md:py-1.5',
              remoteOnly ? 'border-accent-primary bg-accent-primary text-on-accent' : 'border-border-subtle bg-bg-surface text-text-secondary hover:text-text-primary'
            )}
          >
            <Wifi className="h-3.5 w-3.5" /> Remote only
          </button>
        </div>
      )}

      {meta && !loading && !error && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm">
          <ShieldCheck className="h-4 w-4 flex-shrink-0 text-success" />
          <span className="min-w-0 flex-1 text-text-secondary">
            <span className="font-semibold text-text-primary">Scam check on.</span>{' '}
            {includeRisky
              ? 'Showing suspicious listings too.'
              : meta.hidden_risky > 0
                ? `${meta.hidden_risky} suspicious ${meta.hidden_risky === 1 ? 'listing' : 'listings'} hidden.`
                : 'No suspicious listings hidden here.'}
          </span>
          {!includeRisky && meta.hidden_risky > 0 && (
            <button type="button" onClick={() => setIncludeRisky(true)} className="py-2 font-bold text-accent-primary hover:underline md:py-0">
              Show them
            </button>
          )}
          {includeRisky && (
            <button type="button" onClick={() => setIncludeRisky(false)} className="py-2 font-bold text-accent-primary hover:underline md:py-0">
              Hide again
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center">
          <p className="font-bold text-text-primary">Couldn't load jobs</p>
          <p className="mt-1 text-sm text-text-secondary">The server may be waking up. Give it a few seconds.</p>
          <Button className="mt-3" size="sm" onClick={() => load(1)}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
          {meta?.syncing ? (
            <>
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent-primary" />
              <p className="mt-3 font-bold text-text-primary">Fetching the latest jobs…</p>
              <p className="mt-1 text-sm text-text-secondary">This only takes a few seconds the first time.</p>
            </>
          ) : kind === 'walkin' ? (
            <>
              <MapPin className="mx-auto h-6 w-6 text-accent-primary" />
              <p className="mt-3 font-bold text-text-primary">No walk-in drives in the next 7 days</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-text-secondary">
                {hasIndiaSource
                  ? 'We scan job listings and employer posts for walk-in drives happening this week. Check back soon, or try a different city.'
                  : 'Walk-in drives posted by employers on TalentStream show up here for the 7 days before they happen. None are scheduled yet.'}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setKind('apply')}>
                  See jobs to apply online
                </Button>
                <Link to="/jobs/new" className="px-2 py-3 text-xs font-bold text-accent-primary hover:underline md:py-1">
                  Hiring? Post a walk-in drive
                </Link>
              </div>
            </>
          ) : (
            <>
              <Search className="mx-auto h-6 w-6 text-accent-primary" />
              <p className="mt-3 font-bold text-text-primary">{debouncedPlace.trim() ? `No jobs in ${debouncedPlace.trim()} yet` : 'No jobs match'}</p>
              <p className="mt-1 text-sm text-text-secondary">
                {debouncedPlace.trim()
                  ? hasIndiaSource
                    ? 'Try the nearest big city, or clear the city to see everything.'
                    : 'Most jobs here are remote and not tied to a city. India city listings are still being connected, so try Remote only or clear the city.'
                  : 'Try fewer words or clear the filters.'}
              </p>
              {debouncedPlace.trim() && (
                <Button className="mt-3" size="sm" variant="ghost" onClick={() => setPlace('')}>
                  Clear city
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((job) => (
            <FeedJobCard key={job.id} job={job} onReported={handleReported} />
          ))}
          {canLoadMore && (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" onClick={() => load((meta?.page ?? 1) + 1)} loading={loadingMore}>
                Load more ({meta ? meta.total - items.length : 0} left)
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="pt-2 text-center text-xs text-text-muted">
        Jobs are collected from{' '}
        {(meta?.sources ?? []).map((s, i, all) => (
          <span key={s.name}>
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-bold text-text-secondary hover:underline">
              {s.label}
            </a>
            {i < all.length - 1 ? ', ' : ''}
          </span>
        ))}{' '}
        through their official feeds, and every listing links to the original posting. Ratings are automatic checks, not
        guarantees. Never pay to get a job.
      </p>
    </div>
  );
}
