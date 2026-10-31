import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, BriefcaseBusiness, Search } from 'lucide-react';
import { useApplicationStore, Application } from '@/store/applicationStore';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { meetingPath } from '@/services/video';

type StatusFilter = 'all' | 'applied' | 'screening' | 'interviewing' | 'shortlisted' | 'rejected';

const STATUS_CONFIG: Record<string, { label: string; chip: string }> = {
  applied: { label: 'Applied', chip: 'border-border-subtle bg-bg-elevated text-text-primary' },
  screening: { label: 'Under review', chip: 'border-warning/30 bg-warning/10 text-warning' },
  interviewing: { label: 'Interviewing', chip: 'border-success/30 bg-success/10 text-success' },
  shortlisted: { label: 'Shortlisted', chip: 'border-success/30 bg-success/10 text-success' },
  rejected: { label: 'Not selected', chip: 'border-danger/30 bg-danger/10 text-danger' },
};

// The four stages every application moves through
const STEPS = ['Applied', 'Under review', 'AI interview', 'Decision'];
const STEP_OF: Record<string, number> = { applied: 1, screening: 2, interviewing: 3, shortlisted: 4, rejected: 4 };

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'applied', label: 'Applied' },
  { key: 'screening', label: 'Under review' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'rejected', label: 'Rejected' },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ApplicationCard({ app }: { app: Application }) {
  const navigate = useNavigate();
  const config = STATUS_CONFIG[app.status] ?? STATUS_CONFIG['applied'];
  const step = STEP_OF[app.status] ?? 1;
  const isInterviewing = app.status === 'interviewing';
  const isRejected = app.status === 'rejected';

  return (
    <article className="space-y-3 rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-tight text-text-primary">{app.job_title}</h3>
          <p className="mt-0.5 truncate text-sm text-text-secondary">{app.employer_name || 'Company'}</p>
        </div>
        <span className={`flex-shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold ${config.chip}`}>{config.label}</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-text-primary">
          <span>Step {step} of 4</span>
          <span className={isRejected ? 'text-danger' : 'text-secondary'}>{isRejected ? 'Not selected' : STEPS[step - 1]}</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5" role="img" aria-label={`Step ${step} of 4: ${STEPS[step - 1]}`}>
          {STEPS.map((name, i) => (
            <div
              key={name}
              className={`h-1.5 rounded-full ${i < step ? (isRejected && i === 3 ? 'bg-danger' : 'bg-secondary') : 'bg-border-subtle'}`}
            />
          ))}
        </div>
      </div>

      {isInterviewing && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
          <p className="font-semibold text-text-primary">You are invited to an AI interview</p>
          <p className="mt-0.5 text-text-secondary">A short text chat with up to 5 questions. You can start whenever you are ready.</p>
        </div>
      )}

      {app.video_interview && new Date(app.video_interview.scheduled_at).getTime() > Date.now() - 2 * 60 * 60 * 1000 && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
          <p className="font-semibold text-text-primary">
            Video interview: {new Date(app.video_interview.scheduled_at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          </p>
          <Link to={meetingPath(app.id)} className="mt-0.5 inline-block py-1 font-semibold text-accent-primary hover:underline">
            Open meeting page
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3 text-xs text-text-secondary">
        <span>Applied {formatDate(app.created_at)}</span>
        {app.ats_score != null && (
          <span className="font-semibold text-text-primary">
            Resume fit: <span className={app.ats_score >= 70 ? 'text-secondary' : app.ats_score >= 50 ? 'text-warning' : 'text-danger'}>{app.ats_score}/100</span>
          </span>
        )}
      </div>

      {isInterviewing && (
        <Button onClick={() => navigate(`/interview/${app.id}`)} className="w-full">
          Go to interview room
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      )}
    </article>
  );
}

export default function MyApplications() {
  const navigate = useNavigate();
  const { myApplications, isLoading, fetchMyApplications } = useApplicationStore();
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    fetchMyApplications();
  }, [fetchMyApplications]);

  const stats = useMemo(() => ({
    total: myApplications.length,
    applied: myApplications.filter((a) => a.status === 'applied').length,
    screening: myApplications.filter((a) => a.status === 'screening').length,
    interviewing: myApplications.filter((a) => a.status === 'interviewing').length,
    shortlisted: myApplications.filter((a) => a.status === 'shortlisted').length,
    rejected: myApplications.filter((a) => a.status === 'rejected').length,
  }), [myApplications]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return myApplications;
    return myApplications.filter((a) => a.status === activeFilter);
  }, [myApplications, activeFilter]);

  return (
    <div className="space-y-4 sm:space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-3xl font-semibold tracking-tight text-text-primary">My applications</h1>
        <p className="mt-1 text-sm text-text-secondary sm:text-base">Where each application stands, from applied to decision.</p>
      </div>

      {/* Pipeline */}
      {!isLoading && myApplications.length > 0 && (
        <section className="rounded-xl border border-border-subtle bg-bg-surface p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">Application pipeline</span>
            <span className="text-xs text-text-secondary">{stats.total} total</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Applied', value: stats.applied, bar: 'bg-text-primary' },
              { label: 'Under review', value: stats.screening, bar: 'bg-warning' },
              { label: 'Interviewing', value: stats.interviewing, bar: 'bg-secondary' },
            ].map((stage) => (
              <div key={stage.label} className="rounded-lg border border-border-subtle bg-bg-elevated px-1 py-2">
                <div className="text-lg font-semibold text-text-primary">{stage.value}</div>
                <div className="text-xs text-text-secondary">{stage.label}</div>
                <div className={`mx-2 mt-1.5 h-1 rounded-full ${stage.bar}`} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filters */}
      {!isLoading && myApplications.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`min-h-10 px-3 rounded-md text-sm font-semibold transition-colors ${
                activeFilter === key
                  ? 'bg-accent-primary text-on-accent'
                  : 'bg-bg-surface text-text-secondary border border-border-subtle hover:text-text-primary hover:border-border-active'
              }`}
            >
              {label}
              {key !== 'all' && (
                <span className="ml-1.5 opacity-70 text-xs">
                  ({myApplications.filter((a) => a.status === key).length})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Applications List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-lg" />)}
          </div>
        ) : myApplications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 border border-dashed border-border-subtle rounded-lg bg-bg-surface text-center"
          >
            <div className="h-16 w-16 rounded-full bg-accent-muted flex items-center justify-center mb-4">
              <BriefcaseBusiness className="h-8 w-8 text-accent-primary" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">No applications yet</h3>
            <p className="text-text-secondary text-sm max-w-xs mb-6">
              Start applying to jobs and your application history will appear here.
            </p>
            <Button onClick={() => navigate('/dashboard/candidate')}>
              <Search className="h-4 w-4 mr-2" /> Browse Open Jobs
            </Button>
          </motion.div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-text-secondary">No applications with this status.</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map((app) => (
              <ApplicationCard key={app.id} app={app} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
