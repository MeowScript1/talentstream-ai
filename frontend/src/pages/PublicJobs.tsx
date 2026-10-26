import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { FeedExplorer } from '@/components/feed/FeedExplorer';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';

/**
 * The front door: anyone can browse jobs without an account. (The job sources' terms don't allow
 * putting their listings behind a signup, and it's a better first impression anyway.)
 */
export default function PublicJobs() {
  const user = useAuthStore((s) => s.user);
  const dashboard = user?.role === 'employer' ? '/dashboard/recruiter' : '/dashboard/candidate';

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 pb-16 pt-24">
        <div className="mb-6">
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-accent-primary/30 bg-accent-muted px-3 py-1 text-xs font-bold text-accent-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Every job is checked for scams
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
            Real jobs. <span className="text-gradient">No fakes.</span>
          </h1>
          <p className="mt-2 text-text-secondary">
            We collect jobs from job platforms, check each one for the red flags scams share, and show you why. Walk-in
            drives happening this week have their own tab.
          </p>
          {user ? (
            <Link to={dashboard} className="mt-4 inline-block">
              <Button size="sm">Go to my dashboard</Button>
            </Link>
          ) : (
            <p className="mt-3 text-sm text-text-muted">
              No account needed to browse.{' '}
              <Link to="/register" className="font-bold text-accent-primary hover:underline">
                Join free
              </Link>{' '}
              to apply with your saved resume and take AI interviews.
            </p>
          )}
        </div>

        <FeedExplorer />
      </main>
    </div>
  );
}
