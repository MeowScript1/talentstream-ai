import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useJobStore } from '@/store/jobStore';
import { useApplicationStore } from '@/store/applicationStore';
import { useAuthStore } from '@/store/authStore';
import { JobFeedCard } from '@/components/candidate/JobFeedCard';
import { ApplyModal } from '@/components/candidate/ApplyModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/Input';
import { Search, BriefcaseBusiness, Clock, CheckCircle2, RefreshCw, Loader2, FileText, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Job } from '@/types/job';
import { ApplicationStatus } from '@/components/candidate/JobFeedCard';

const DEBOUNCE_MS = 350;

export default function CandidateDashboard() {
  const { jobs, isLoading: jobsLoading, isSearching, fetchJobs, searchJobs } = useJobStore();
  const { myApplications, fetchMyApplications } = useApplicationStore();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial fetch
  useEffect(() => {
    fetchJobs();
    fetchMyApplications();
  }, [fetchJobs, fetchMyApplications]);

  // Auto-refresh jobs every 30 seconds so newly posted jobs appear quickly
  useEffect(() => {
    const interval = setInterval(() => {
      // Only auto-refresh if user isn't actively searching
      if (!searchQuery.trim() && !selectedType) {
        fetchJobs();
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [searchQuery, selectedType, fetchJobs]);

  // Debounced server-side search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      searchJobs(value, selectedType ?? undefined);
    }, DEBOUNCE_MS);
  }, [selectedType, searchJobs]);

  // Type filter triggers immediate search
  const handleTypeChange = useCallback((type: string | null) => {
    setSelectedType(type);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    searchJobs(searchQuery, type ?? undefined);
  }, [searchQuery, searchJobs]);

  // Manual refresh
  const handleRefresh = useCallback(() => {
    searchJobs(searchQuery, selectedType ?? undefined);
  }, [searchQuery, selectedType, searchJobs]);

  // Build a map: job_id -> application status
  const applicationStatusMap = useMemo(() => {
    const map = new Map<string, ApplicationStatus>();
    myApplications.forEach((app) => {
      map.set(app.job_id, app.status as ApplicationStatus);
    });
    return map;
  }, [myApplications]);

  // Build a map: job_id -> application_id (for interview navigation)
  const applicationIdMap = useMemo(() => {
    const map = new Map<string, string>();
    myApplications.forEach((app) => {
      map.set(app.job_id, app.id);
    });
    return map;
  }, [myApplications]);


  // Client-side skill filter (skills aren't searched server-side)
  const filteredJobs = useMemo(() => {
    return jobs;
  }, [jobs]);

  // Stats
  const appliedCount = myApplications.length;
  const interviewingCount = myApplications.filter(a => a.status === 'interviewing').length;
  const shortlistedCount = myApplications.filter(a => a.status === 'shortlisted').length;

  const JOB_TYPE_OPTIONS = [
    { label: 'All', value: null },
    { label: 'Full Time', value: 'full_time' },
    { label: 'Part Time', value: 'part_time' },
    { label: 'Contract', value: 'contract' },
    { label: 'Remote', value: 'remote' },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary">Find your next <span className="text-gradient">gig</span> ✨</h1>
        <p className="text-text-secondary mt-1">AI matches you with roles that actually fit. No doomscrolling job boards.</p>
      </div>

      {/* Prompt to save a resume (shown until they do) */}
      {user && !user.resume_filename && (
        <Link
          to="/profile#resume"
          className="group flex items-center gap-4 rounded-3xl border border-accent-primary/30 bg-accent-muted p-4 transition-all hover:border-accent-primary/60 hover:shadow-glow"
        >
          <div className="flex h-11 w-11 flex-shrink-0 -rotate-6 items-center justify-center rounded-2xl bg-accent-primary text-bg-base">
            <FileText className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text-primary">Add your resume once, apply in one click</p>
            <p className="text-xs text-text-secondary">Save a PDF on your profile and skip the upload on every job.</p>
          </div>
          <ArrowRight className="h-5 w-5 flex-shrink-0 text-accent-primary transition-transform group-hover:translate-x-1" />
        </Link>
      )}

      {/* Stats row */}
      {myApplications.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[
            { label: 'Applied', value: appliedCount, icon: BriefcaseBusiness, color: 'text-accent-primary bg-accent-muted' },
            { label: 'Interviewing', value: interviewingCount, icon: Clock, color: 'text-warning bg-warning/10' },
            { label: 'Shortlisted', value: shortlistedCount, icon: CheckCircle2, color: 'text-success bg-success/10' },
          ].map((stat) => (
            <div key={stat.label} className="min-w-0 bg-bg-surface/80 backdrop-blur-xl border border-white/[0.07] rounded-3xl p-3 sm:p-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 shadow-card">
              <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-3xl font-extrabold text-text-primary leading-none">{stat.value}</div>
                <div className="truncate text-xs text-text-secondary">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search bar with refresh */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-5 top-1/2 z-10 -translate-y-1/2 h-5 w-5 text-text-secondary" />
        <Input 
          className="pl-12 pr-12 h-14 text-base rounded-full shadow-card bg-bg-surface/80 backdrop-blur-xl"
          placeholder="Search roles, companies, vibes…"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        <button
          onClick={handleRefresh}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 md:right-4 md:h-8 md:w-8 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-all"
          title="Refresh jobs"
        >
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Job type filter chips */}
      <div className="flex flex-wrap gap-2">
        {JOB_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => handleTypeChange(opt.value)}
            className={`px-4 py-3 md:py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedType === opt.value 
                ? 'bg-accent-primary text-bg-base' 
                : 'bg-bg-surface text-text-secondary border border-border-subtle hover:text-text-primary'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {jobsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-2xl" />
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-border-subtle rounded-2xl bg-bg-surface text-center">
            <Search className="h-12 w-12 text-text-muted mb-4" />
            <h3 className="text-lg font-medium text-text-primary mb-2">No jobs found</h3>
            <p className="text-text-secondary max-w-sm">
              We couldn't find any open positions matching your search criteria. Try adjusting your filters.
            </p>
            {(searchQuery || selectedType) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedType(null);
                  fetchJobs();
                }}
                className="mt-4 px-5 py-2 rounded-2xl text-sm font-semibold text-accent-primary border border-accent-primary hover:bg-accent-muted transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <motion.div 
            className="space-y-4"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.05 }
              }
            }}
            initial="hidden"
            animate="show"
          >
            <AnimatePresence>
              {filteredJobs.map((job: Job) => {
                const status = applicationStatusMap.get(job.id) ?? null;
                const appId = applicationIdMap.get(job.id);

                return (
                  <JobFeedCard 
                    key={job.id} 
                    job={job} 
                    status={status}
                    onApply={undefined} // handled by ApplyModal below as trigger
                    onInterview={() => appId && navigate(`/interview/${appId}`)}
                    applyTrigger={
                      status === null ? (
                        <ApplyModal
                          job={job}
                          trigger={
                            <button className="px-5 py-2.5 rounded-2xl text-sm font-semibold bg-accent-primary text-bg-base hover:bg-accent-primary/90 transition-colors">
                              Apply Now
                            </button>
                          }
                          onSuccess={() => fetchMyApplications()}
                        />
                      ) : undefined
                    }
                  />
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
