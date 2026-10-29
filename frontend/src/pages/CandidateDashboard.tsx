import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJobStore } from '@/store/jobStore';
import { useApplicationStore } from '@/store/applicationStore';
import { JobFeedCard } from '@/components/candidate/JobFeedCard';
import { ApplyModal } from '@/components/candidate/ApplyModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { FeedExplorer } from '@/components/feed/FeedExplorer';
import { Input } from '@/components/ui/Input';
import { Search, BriefcaseBusiness, Clock, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Job } from '@/types/job';
import { ApplicationStatus } from '@/components/candidate/JobFeedCard';

const DEBOUNCE_MS = 350;

export default function CandidateDashboard() {
  const { jobs, isLoading: jobsLoading, isSearching, fetchJobs, searchJobs } = useJobStore();
  const { myApplications, fetchMyApplications } = useApplicationStore();
  const navigate = useNavigate();
  // 'feed' = jobs collected from other platforms (the default); 'native' = jobs posted directly on TalentStream
  const [section, setSection] = useState<'feed' | 'native'>('feed');
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
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">Jobs</h1>
        <p className="text-text-secondary mt-1">Listings from several job sites with a scam check on each, plus jobs and walk-in drives posted on TalentStream.</p>
      </div>

      {/* Stats row */}
      {myApplications.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[
            { label: 'Applied', value: appliedCount, icon: BriefcaseBusiness, color: 'text-accent-primary bg-accent-muted' },
            { label: 'Interviewing', value: interviewingCount, icon: Clock, color: 'text-warning bg-warning/10' },
            { label: 'Shortlisted', value: shortlistedCount, icon: CheckCircle2, color: 'text-success bg-success/10' },
          ].map((stat) => (
            <div key={stat.label} className="min-w-0 bg-bg-surface/80  border border-white/[0.07] rounded-xl p-3 sm:p-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 shadow-card">
              <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-lg flex items-center justify-center flex-shrink-0 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-2xl font-semibold text-text-primary leading-none">{stat.value}</div>
                <div className="truncate text-xs text-text-secondary">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Where the jobs come from */}
      <div className="flex flex-wrap items-center gap-2">
        {([['feed', 'Jobs from everywhere'], ['native', 'Posted on TalentStream']] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            aria-pressed={section === key}
            className={`min-h-11 rounded-md border px-4 text-sm font-bold transition-colors md:min-h-0 md:py-1.5 ${
              section === key
                ? 'border-accent-primary bg-accent-primary text-bg-base'
                : 'border-border-subtle bg-bg-surface text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'feed' && <FeedExplorer />}

      {section === 'native' && (
        <>
        {/* Search bar with refresh */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-5 top-1/2 z-10 -translate-y-1/2 h-5 w-5 text-text-secondary" />
          <Input 
            className="pl-12 pr-12 h-12 text-base rounded-md shadow-card bg-bg-surface/80 "
            placeholder="Search roles, companies, skills"
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
              className={`px-4 py-3 md:py-1.5 rounded-md text-sm font-medium transition-colors ${
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
                <Skeleton key={i} className="h-48 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 border border-dashed border-border-subtle rounded-lg bg-bg-surface text-center">
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
                  className="mt-4 px-5 py-2 rounded-lg text-sm font-semibold text-accent-primary border border-accent-primary hover:bg-accent-muted transition-colors"
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
                              <button className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-accent-primary text-bg-base hover:bg-accent-primary/90 transition-colors">
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
        </>
      )}
    </div>
  );
}
