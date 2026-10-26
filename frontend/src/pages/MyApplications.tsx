import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BriefcaseBusiness,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Video,
  Bot,
  Building2,
  CalendarDays,
} from 'lucide-react';
import { useApplicationStore, Application } from '@/store/applicationStore';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

type StatusFilter = 'all' | 'applied' | 'screening' | 'interviewing' | 'shortlisted' | 'rejected';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  applied: { label: 'Applied', color: 'text-text-secondary bg-bg-elevated border-border-subtle', icon: BriefcaseBusiness },
  screening: { label: 'Under Review', color: 'text-warning bg-warning/10 border-warning/20', icon: Clock },
  interviewing: { label: 'Interviewing', color: 'text-accent-primary bg-accent-muted border-accent-primary/20', icon: Video },
  shortlisted: { label: 'Shortlisted', color: 'text-success bg-success/10 border-success/20', icon: CheckCircle2 },
  rejected: { label: 'Not Selected', color: 'text-danger bg-danger/10 border-danger/20', icon: XCircle },
};

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'applied', label: 'Applied' },
  { key: 'screening', label: 'Screening' },
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
  const StatusIcon = config.icon;
  const isInterviewing = app.status === 'interviewing';
  const isShortlisted = app.status === 'shortlisted';
  const isRejected = app.status === 'rejected';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`bg-bg-surface border rounded-2xl p-5 shadow-card transition-all duration-200 ${
        isInterviewing
          ? 'border-accent-primary/40 shadow-glow'
          : isShortlisted
          ? 'border-success/30'
          : isRejected
          ? 'border-border-subtle opacity-70'
          : 'border-border-subtle hover:border-border-active'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Company initial avatar */}
          <div
            className={`h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-base font-bold ${
              isInterviewing
                ? 'bg-accent-muted text-accent-primary border border-accent-primary/30'
                : 'bg-bg-elevated border border-border-subtle text-text-secondary'
            }`}
          >
            {(app.employer_name || app.job_title || 'J').charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-text-primary truncate">{app.job_title}</h3>
            <div className="flex items-center gap-1.5 text-sm text-text-secondary mt-0.5">
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{app.employer_name || 'Company'}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
              {/* Status badge */}
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${config.color}`}>
                <StatusIcon className="h-3.5 w-3.5" />
                {config.label}
              </div>

              {/* ATS Score */}
              {app.ats_score != null && (
                <div
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                    app.ats_score >= 80
                      ? 'text-success bg-success/10 border-success/20'
                      : app.ats_score >= 60
                      ? 'text-warning bg-warning/10 border-warning/20'
                      : 'text-danger bg-danger/10 border-danger/20'
                  }`}
                >
                  <Bot className="h-3 w-3" />
                  {app.ats_score}/100
                </div>
              )}

              {/* Date */}
              <div className="inline-flex items-center gap-1 text-xs text-text-muted">
                <CalendarDays className="h-3 w-3" />
                Applied {formatDate(app.created_at)}
              </div>
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="sm:ml-4 flex-shrink-0">
          {isInterviewing ? (
            <Button
              onClick={() => navigate(`/interview/${app.id}`)}
              className="animate-pulse ring-2 ring-accent-primary ring-offset-2 ring-offset-bg-base text-sm"
              size="sm"
            >
              <Video className="h-3.5 w-3.5 mr-1.5" />
              Enter Interview
            </Button>
          ) : isShortlisted ? (
            <div className="flex items-center gap-1.5 text-success text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              You're in! 🎉
            </div>
          ) : null}
        </div>
      </div>

      {/* Interviewing pulse bar */}
      {isInterviewing && (
        <div className="mt-4 h-0.5 rounded-full bg-bg-elevated overflow-hidden">
          <div className="h-full w-full bg-accent-primary/40 animate-pulse" />
        </div>
      )}
    </motion.div>
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
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary">My Applications</h1>
        <p className="text-text-secondary mt-1">Track the status of every job you've applied to.</p>
      </div>

      {/* Stats */}
      {!isLoading && myApplications.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-3"
        >
          {[
            { label: 'Total', value: stats.total, color: 'text-text-primary', bg: 'bg-bg-elevated' },
            { label: 'Reviewing', value: stats.screening, color: 'text-warning', bg: 'bg-warning/10' },
            { label: 'Interview', value: stats.interviewing, color: 'text-accent-primary', bg: 'bg-accent-muted' },
            { label: 'Shortlisted', value: stats.shortlisted, color: 'text-success', bg: 'bg-success/10' },
            { label: 'Rejected', value: stats.rejected, color: 'text-danger', bg: 'bg-danger/10' },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl px-4 py-3 border border-border-subtle ${stat.bg} text-center`}
            >
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-text-muted mt-0.5">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Filters */}
      {!isLoading && myApplications.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`px-4 py-3 md:py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeFilter === key
                  ? 'bg-accent-primary text-bg-base'
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
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}
          </div>
        ) : myApplications.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 border border-dashed border-border-subtle rounded-2xl bg-bg-surface text-center"
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
