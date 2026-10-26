import { useEffect } from 'react';
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
  }, []);

  const openJobs = myJobs.filter((j) => j.status === 'open').length;
  const closedJobs = myJobs.filter((j) => j.status === 'closed').length;
  const totalJobs = myJobs.length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary">Hey {firstName} <span className="inline-block origin-[70%_70%] animate-wiggle">👋</span></h1>
          <p className="text-text-secondary mt-1">Here's what's happening with your hiring today.</p>
        </div>
        <PostJobModal />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Active Jobs', value: openJobs, sub: 'open positions', emoji: '🔥', color: 'text-accent-primary', glow: 'hover:border-accent-primary/50' },
          { label: 'Closed Jobs', value: closedJobs, sub: 'filled or closed', emoji: '✅', color: 'text-violet', glow: 'hover:border-violet/60' },
          { label: 'Total Posted', value: totalJobs, sub: 'all time', emoji: '📈', color: 'text-pink', glow: 'hover:border-pink/60' },
        ].map((stat, i) => (
          <div key={i} className={`relative overflow-hidden rounded-3xl border border-white/[0.07] bg-bg-surface/80 p-6 shadow-card backdrop-blur-xl transition-all hover:-translate-y-1 ${stat.glow}`}>
            <span className="absolute right-5 top-5 text-2xl">{stat.emoji}</span>
            <div className={`font-display text-6xl font-extrabold leading-none mb-3 ${stat.color}`}>{stat.value}</div>
            <div className="text-sm font-bold text-text-primary">{stat.label}</div>
            <div className="text-xs text-text-muted mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-2xl font-extrabold text-text-primary mb-6">Your jobs</h2>
        
        {isLoading ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : myJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-white/15 rounded-3xl bg-white/[0.02]">
            <div className="h-20 w-20 rounded-3xl bg-accent-muted flex items-center justify-center mb-4 -rotate-6">
              <span className="text-2xl">💼</span>
            </div>
            <h3 className="text-xl font-extrabold text-text-primary mb-2">Nothing here yet</h3>
            <p className="text-text-secondary mb-6 text-center max-w-sm">Drop your first job and let AI do the screening. You'll have a ranked shortlist before your coffee's cold ☕</p>
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
