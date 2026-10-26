import { useEffect, type SVGProps } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApplicationStore, type Application } from '@/store/applicationStore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Check, X, FileText, Bot, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface ApplicantListProps {
  jobId: string;
  onViewDetail?: (appId: string) => void;
}

export function ApplicantList({ jobId, onViewDetail }: ApplicantListProps) {
  const { jobApplicants, isLoading, fetchJobApplicants, updateApplicantStatus } = useApplicationStore();

  useEffect(() => {
    fetchJobApplicants(jobId);
  }, [jobId, fetchJobApplicants]);

  const handleStatusUpdate = async (appId: string, status: Application['status']) => {
    try {
      await updateApplicantStatus(appId, status);
      toast.success('Status updated');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const renderScore = (score: number | null | undefined) => {
    if (score == null) return <Badge variant="screening">Processing...</Badge>;
    let colorClass = 'text-text-primary bg-bg-elevated';
    if (score >= 80) colorClass = 'text-success bg-success/10 border-success/20';
    else if (score >= 60) colorClass = 'text-warning bg-warning/10 border-warning/20';
    else colorClass = 'text-danger bg-danger/10 border-danger/20';
    
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-semibold text-sm ${colorClass}`}>
        <Bot className="h-4 w-4" />
        {score} / 100
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
      </div>
    );
  }

  if (jobApplicants.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <UsersIcon className="h-12 w-12 mx-auto mb-3 text-text-muted" />
        <p className="font-medium text-text-primary mb-1">No applicants yet</p>
        <p className="text-sm">Share the job to start receiving applications.</p>
      </div>
    );
  }

  // Sort by score descending
  const sortedApplicants = [...jobApplicants].sort((a, b) => (b.ats_score || 0) - (a.ats_score || 0));

  return (
    <div className="space-y-4">
      <div className="text-sm text-text-secondary">
        {sortedApplicants.length} applicant{sortedApplicants.length !== 1 ? 's' : ''} found
      </div>
      <AnimatePresence>
        {sortedApplicants.map((app) => (
          <motion.div
            key={app.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-base font-bold text-text-primary">
                    {app.candidate_name || `Candidate #${app.candidate_id.substring(0, 8)}`}
                  </h4>
                  <div className="md:hidden">{renderScore(app.ats_score)}</div>
                </div>
                
                {app.ats_summary && (
                  <p className="text-sm text-text-secondary mb-4 italic border-l-2 border-accent-primary/50 pl-3 py-1">
                    "{app.ats_summary}"
                  </p>
                )}
                
                <div className="flex items-center gap-3">
                  <a 
                    href={app.resume_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm font-medium text-accent-primary hover:underline bg-accent-muted px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    View Resume
                  </a>
                  <Badge variant={app.status === 'shortlisted' ? 'shortlisted' : app.status === 'rejected' ? 'rejected' : 'screening'}>
                    {app.status}
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 md:flex-col md:items-end min-w-[140px]">
                <div className="hidden md:block">{renderScore(app.ats_score)}</div>
                
                <div className="flex items-center gap-2">
                  {app.status !== 'rejected' && app.status !== 'shortlisted' && (
                    <>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="text-success hover:bg-success/10 hover:text-success border-success/30 hover:border-success/50 rounded-full h-11 w-11 md:h-9 md:w-9"
                        onClick={() => handleStatusUpdate(app.id, 'shortlisted')}
                        title="Shortlist"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="text-danger hover:bg-danger/10 hover:text-danger border-danger/30 hover:border-danger/50 rounded-full h-11 w-11 md:h-9 md:w-9"
                        onClick={() => handleStatusUpdate(app.id, 'rejected')}
                        title="Reject"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {onViewDetail && (
                    <Button 
                      size="icon" 
                      variant="ghost"
                      className="rounded-full h-11 w-11 md:h-9 md:w-9"
                      onClick={() => onViewDetail(app.id)}
                      title="View full details"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function UsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
