import { motion } from 'framer-motion';
import { MapPin, Clock } from 'lucide-react';
import { Job } from '@/types/job';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

// Application status for a candidate on a specific job
export type ApplicationStatus = 'applied' | 'screening' | 'interviewing' | 'shortlisted' | 'rejected' | null;

interface JobFeedCardProps {
  job: Job;
  status?: ApplicationStatus;
  onApply?: () => void;
  onInterview?: () => void;
  applyTrigger?: React.ReactNode; // Allows injecting the ApplyModal directly
}

export function JobFeedCard({ job, status = null, onApply, onInterview, applyTrigger }: JobFeedCardProps) {
  const timeAgo = (dateString: string) => {
    const days = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 3600 * 24));
    return days === 0 ? 'Today' : `${days}d ago`;
  };

  const getActionSection = () => {
    switch (status) {
      case null:
        return applyTrigger ?? <Button onClick={onApply}>Apply Now</Button>;
      case 'applied':
        return <Button variant="ghost" disabled>Application Submitted</Button>;
      case 'screening':
        return <Badge variant="screening">Under Review</Badge>;
      case 'interviewing':
        return (
          <Button 
            className="ring-2 ring-accent-primary ring-offset-2 ring-offset-bg-base animate-pulse" 
            onClick={onInterview}
          >
            Enter Interview
          </Button>
        );
      case 'shortlisted':
        return <Badge variant="shortlisted">Shortlisted</Badge>;
      case 'rejected':
        return <Badge variant="rejected">Not Selected</Badge>;
    }
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
      }}
    >
      <Card variant={status === 'interviewing' ? 'elevated' : 'default'} className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-xl font-bold text-text-primary mb-1">{job.title}</h3>
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <span className="font-medium text-text-primary">{job.employer_name}</span>
                {job.location && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location}</span>
                  </>
                )}
                {job.salary_range && (
                  <>
                    <span>•</span>
                    <span className="text-success font-medium">{job.salary_range}</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1 text-xs text-text-muted bg-bg-elevated px-2.5 py-1 rounded-md border border-border-subtle md:hidden">
              <Clock className="h-3 w-3" />
              {timeAgo(job.created_at)}
            </div>
          </div>

          <p className="text-sm text-text-secondary mb-4 line-clamp-2">{job.description}</p>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            {job.requirements.slice(0, 5).map((req, i) => (
              <span key={i} className="text-xs bg-bg-elevated text-text-primary px-2 py-1 rounded-md border border-border-subtle">
                {req}
              </span>
            ))}
            {job.requirements.length > 5 && (
              <span className="text-xs text-text-muted px-1">+{job.requirements.length - 5}</span>
            )}
          </div>
        </div>

        <div className="flex md:flex-col items-center justify-between gap-4 md:items-end min-w-[140px] border-t border-border-subtle pt-4 md:pt-0 md:border-t-0 md:border-l md:pl-6">
          <div className="hidden md:flex items-center gap-1 text-xs text-text-muted bg-bg-elevated px-2.5 py-1 rounded-md border border-border-subtle">
            <Clock className="h-3 w-3" />
            {timeAgo(job.created_at)}
          </div>
          {getActionSection()}
        </div>
      </Card>
    </motion.div>
  );
}
