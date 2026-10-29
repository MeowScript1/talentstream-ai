import { useEffect } from 'react';
import { Briefcase } from 'lucide-react';
import { useJobStore } from '@/store/jobStore';
import { JobCard } from '@/components/recruiter/JobCard';
import { PostJobModal } from '@/components/recruiter/PostJobModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';

export default function RecruiterDashboard() {
  const { myJobs, isLoading, fetchMyJobs } = useJobStore();
  const { user } = useAuthStore();
  const firstName = user?.full_name?.split(' ')[0] ?? 'there';

  useEffect(() => {
    fetchMyJobs();
  }, [fetchMyJobs]);

  const openJobs = myJobs.filter((j) => j.status === 'open').length;
  const closedJobs = myJobs.filter((j) => j.status === 'closed').length;
  const totalJobs = myJobs.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">Hello, {firstName}</h1>
          <p className="text-text-secondary mt-1">Your jobs, walk-in drives and applicants.</p>
        </div>
        <PostJobModal />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6">
        {[
          { label: 'Active Jobs', value: openJobs, sub: 'open positions', color: 'text-accent-primary', glow: 'hover:border-white/20' },
          { label: 'Closed Jobs', value: closedJobs, sub: 'filled or closed', color: 'text-text-primary', glow: 'hover:border-white/20' },
          { label: 'Total Posted', value: totalJobs, sub: 'all time', color: 'text-text-primary', glow: 'hover:border-white/20' },
        ].map((stat, i) => (
          <div key={i} className={`relative min-w-0 overflow-hidden rounded-xl border border-white/[0.07] bg-bg-surface/80 p-3 sm:p-6 shadow-card  transition-colors ${stat.glow}`}>
            <div className={`font-display text-3xl sm:text-5xl font-semibold leading-none mb-2 sm:mb-3 ${stat.color}`}>{stat.value}</div>
            <div className="truncate text-xs sm:text-sm font-bold text-text-primary">{stat.label}</div>
            <div className="hidden text-xs text-text-muted mt-0.5 sm:block">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-text-primary mb-6">Your jobs</h2>
        
        {isLoading ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : myJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-white/15 rounded-xl bg-white/[0.02]">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-accent-muted text-accent-primary">
              <Briefcase className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold text-text-primary mb-2">Nothing here yet</h3>
            <p className="text-text-secondary mb-6 text-center max-w-sm">Post your first job or walk-in drive. Applicants are scored automatically when they apply.</p>
            <PostJobModal />
          </div>
        ) : (
          <motion.div 
            className="grid grid-cols-1 xl:grid-cols-2 gap-6"
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
            {myJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
