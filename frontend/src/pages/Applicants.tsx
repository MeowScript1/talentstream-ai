import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Bot,
  FileText,
  ArrowRight,
  Check,
  X,
  ChevronDown,
  BarChart2,
  RotateCw,
} from 'lucide-react';
import { useJobStore } from '@/store/jobStore';
import { useApplicationStore, type Application } from '@/store/applicationStore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import toast from 'react-hot-toast';

type StatusFilter = 'all' | 'screening' | 'interviewing' | 'shortlisted' | 'rejected';

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: 'All',
  screening: 'Screening',
  interviewing: 'Interviewing',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
};

export default function Applicants() {
  const navigate = useNavigate();
  const { myJobs, fetchMyJobs, isLoading: jobsLoading } = useJobStore();
  const { jobApplicants, isLoading: appsLoading, fetchJobApplicants, updateApplicantStatus, rescoreApplication } =
    useApplicationStore();

  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rescoringId, setRescoringId] = useState<string | null>(null);

  useEffect(() => {
    fetchMyJobs();
  }, [fetchMyJobs]);

  useEffect(() => {
    if (myJobs.length > 0 && !selectedJobId) {
      setSelectedJobId(myJobs[0].id);
    }
  }, [myJobs, selectedJobId]);

  useEffect(() => {
    if (selectedJobId) {
      fetchJobApplicants(selectedJobId);
      setStatusFilter('all');
    }
  }, [selectedJobId, fetchJobApplicants]);

  const selectedJob = useMemo(
    () => myJobs.find((j) => j.id === selectedJobId),
    [myJobs, selectedJobId]
  );

  const filteredApplicants = useMemo(() => {
    const sorted = [...jobApplicants].sort((a, b) => (b.ats_score || 0) - (a.ats_score || 0));
    if (statusFilter === 'all') return sorted;
    return sorted.filter((a) => a.status === statusFilter);
  }, [jobApplicants, statusFilter]);

  const stats = useMemo(() => ({
    total: jobApplicants.length,
    shortlisted: jobApplicants.filter((a) => a.status === 'shortlisted').length,
    interviewing: jobApplicants.filter((a) => a.status === 'interviewing').length,
    rejected: jobApplicants.filter((a) => a.status === 'rejected').length,
  }), [jobApplicants]);

  const handleStatus = async (appId: string, status: Application['status']) => {
    setUpdatingId(appId);
    try {
      await updateApplicantStatus(appId, status);
      toast.success(status === 'shortlisted' ? 'Candidate shortlisted' : 'Candidate rejected');
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRescore = async (appId: string) => {
    setRescoringId(appId);
    try {
      await rescoreApplication(appId);
      toast.success('Re-scoring started. Results will update shortly');
    } catch {
      toast.error('Failed to start re-scoring');
    } finally {
      setRescoringId(null);
    }
  };

  const renderScore = (score: number | null | undefined) => {
    if (score == null)
      return <span className="text-xs text-text-muted italic">Not scored yet</span>;
    const color =
      score >= 80
        ? 'text-success bg-success/10 border-success/20'
        : score >= 60
        ? 'text-warning bg-warning/10 border-warning/20'
        : 'text-danger bg-danger/10 border-danger/20';
    return (
      <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold ${color}`}>
        <Bot className="h-3.5 w-3.5" />
        {score}
        <span className="font-normal text-xs opacity-70">/100</span>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">Applicants</h1>
        <p className="text-text-secondary mt-1">Review and manage candidates across your job postings.</p>
      </div>

      {/* Job Selector */}
      <div className="relative">
        {jobsLoading ? (
          <Skeleton className="h-14 w-full rounded-lg" />
        ) : myJobs.length === 0 ? (
          <div className="p-6 rounded-lg border border-dashed border-border-subtle bg-bg-surface text-center">
            <p className="text-text-secondary text-sm">
              You haven't posted any jobs yet.{' '}
              <button
                onClick={() => navigate('/jobs/new')}
                className="text-accent-primary hover:underline font-medium"
              >
                Post your first job →
              </button>
            </p>
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setJobDropdownOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-3 bg-bg-surface border border-border-subtle rounded-lg px-5 py-4 text-left hover:border-border-active transition-colors shadow-card"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 text-accent-primary" />
                </div>
                <div>
                  <div className="text-base font-semibold text-text-primary">
                    {selectedJob?.title ?? 'Select a job'}
                  </div>
                  {selectedJob && (
                    <div className="text-xs text-text-muted capitalize">{selectedJob.job_type.replace('_', ' ')} · {selectedJob.status}</div>
                  )}
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-text-muted transition-transform duration-200 ${jobDropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence>
              {jobDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-0 mt-2 z-20 bg-bg-surface border border-border-subtle rounded-lg shadow-glow overflow-hidden"
                >
                  {myJobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => { setSelectedJobId(job.id); setJobDropdownOpen(false); }}
                      className={`w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-bg-elevated transition-colors border-b border-border-subtle last:border-0 ${
                        job.id === selectedJobId ? 'bg-accent-muted' : ''
                      }`}
                    >
                      <div>
                        <div className="text-sm font-medium text-text-primary">{job.title}</div>
                        <div className="text-xs text-text-muted capitalize">{job.job_type.replace('_', ' ')}</div>
                      </div>
                      <Badge variant={job.status === 'open' ? 'interviewing' : 'applied'}>
                        {job.status}
                      </Badge>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Stats */}
      {selectedJobId && !appsLoading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { label: 'Total Applied', value: stats.total, icon: Users, color: 'text-accent-primary bg-accent-muted' },
            { label: 'Interviewing', value: stats.interviewing, icon: Clock, color: 'text-warning bg-warning/10' },
            { label: 'Shortlisted', value: stats.shortlisted, icon: CheckCircle2, color: 'text-success bg-success/10' },
            { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-danger bg-danger/10' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-bg-surface border border-border-subtle rounded-lg p-4 flex items-center gap-3 shadow-card"
            >
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text-primary">{stat.value}</div>
                <div className="text-xs text-text-secondary">{stat.label}</div>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Status Filters */}
      {selectedJobId && !appsLoading && jobApplicants.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-3 md:py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-accent-primary text-on-accent'
                  : 'bg-bg-surface text-text-secondary border border-border-subtle hover:text-text-primary hover:border-border-active'
              }`}
            >
              {STATUS_LABELS[s]}
              {s !== 'all' && (
                <span className="ml-1.5 opacity-70 text-xs">
                  ({jobApplicants.filter((a) => a.status === s).length})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Applicant List */}
      {selectedJobId && (
        <div className="space-y-4">
          {appsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
            </div>
          ) : filteredApplicants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border-subtle rounded-lg bg-bg-surface text-center">
              <BarChart2 className="h-12 w-12 text-text-muted mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-text-primary mb-2">
                {jobApplicants.length === 0 ? 'No applicants yet' : 'No applicants in this category'}
              </h3>
              <p className="text-sm text-text-secondary max-w-sm">
                {jobApplicants.length === 0
                  ? 'Share the job posting to start receiving applications.'
                  : 'Try selecting a different status filter.'}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredApplicants.map((app, i) => (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-9 w-9 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center flex-shrink-0 text-sm font-bold text-text-primary">
                          {(app.candidate_name || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-base font-bold text-text-primary truncate">
                            {app.candidate_name || `Candidate #${app.candidate_id?.substring(0, 8)}`}
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap mt-0.5">
                            {renderScore(app.ats_score)}
                            <Badge
                              variant={
                                app.status === 'shortlisted'
                                  ? 'shortlisted'
                                  : app.status === 'rejected'
                                  ? 'rejected'
                                  : app.status === 'interviewing'
                                  ? 'interviewing'
                                  : 'screening'
                              }
                            >
                              {app.status}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {app.ats_summary && (
                        <p className="text-xs text-text-secondary border-l-2 border-accent-primary/40 pl-3 ml-12 italic line-clamp-2">
                          {app.ats_summary}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-12 md:ml-0">
                      <a
                        href={app.resume_url}
                        target="_blank"
                        rel="noreferrer"
                        title="View Resume"
                        className="h-11 w-11 md:h-9 md:w-9 flex items-center justify-center rounded-full border border-border-subtle text-text-secondary hover:text-accent-primary hover:border-accent-primary/40 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                      </a>

                      <Button
                        size="icon"
                        variant="outline"
                        className="rounded-full h-11 w-11 md:h-9 md:w-9 text-accent-primary hover:bg-accent-muted hover:text-accent-primary border-accent-primary/30 hover:border-accent-primary/50"
                        onClick={() => handleRescore(app.id)}
                        disabled={rescoringId === app.id}
                        title="Re-score with AI"
                      >
                        <RotateCw className={`h-4 w-4 ${rescoringId === app.id ? 'animate-spin' : ''}`} />
                      </Button>

                      {app.status !== 'rejected' && app.status !== 'shortlisted' && (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-full h-11 w-11 md:h-9 md:w-9 text-success hover:bg-success/10 hover:text-success border-success/30 hover:border-success/50"
                            onClick={() => handleStatus(app.id, 'shortlisted')}
                            disabled={updatingId === app.id}
                            title="Shortlist"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="rounded-full h-11 w-11 md:h-9 md:w-9 text-danger hover:bg-danger/10 hover:text-danger border-danger/30 hover:border-danger/50"
                            onClick={() => handleStatus(app.id, 'rejected')}
                            disabled={updatingId === app.id}
                            title="Reject"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full h-11 w-11 md:h-9 md:w-9"
                        onClick={() => navigate(`/applicant/${app.id}`)}
                        title="View full details"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  );
}
