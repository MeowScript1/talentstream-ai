import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Clock, Users } from 'lucide-react';
import { Job } from '@/types/job';
import { useJobStore } from '@/store/jobStore';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ApplicantList } from '@/components/recruiter/ApplicantList';
import { Modal, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Modal';
import toast from 'react-hot-toast';

export function JobCard({ job }: { job: Job }) {
  const { closeJob } = useJobStore();
  const navigate = useNavigate();
  const [isClosing, setIsClosing] = useState(false);
  const [showApplicants, setShowApplicants] = useState(false);

  const handleClose = async () => {
    if (!confirm('Are you sure you want to close this job?')) return;
    setIsClosing(true);
    try {
      await closeJob(job.id);
      toast.success('Job closed successfully');
    } catch {
      toast.error('Failed to close job');
    } finally {
      setIsClosing(false);
    }
  };

  const timeAgo = (dateString: string) => {
    const days = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / (1000 * 3600 * 24));
    return days === 0 ? 'Today' : `${days}d ago`;
  };

  return (
    <>
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 20 },
          show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
        }}
      >
        <Card variant="interactive" className="h-full flex flex-col relative group overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
            {job.status === 'open' && (
              <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10 hover:border-danger/30 hover:text-danger" onClick={handleClose} loading={isClosing}>
                Close Job
              </Button>
            )}
          </div>

          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-1">{job.title}</h3>
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <span className="font-medium text-text-primary">{job.employer_name}</span>
                {job.location && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {job.location}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-6">
            <Badge variant={job.status === 'open' ? 'interviewing' : 'applied'}>
              {job.status}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-text-muted bg-bg-elevated px-2.5 py-1 rounded-md border border-border-subtle">
              <Clock className="h-3 w-3" />
              {timeAgo(job.created_at)}
            </div>
            {job.salary_range && (
              <div className="text-xs font-medium text-success bg-success/10 px-2.5 py-1 rounded-md border border-success/20">
                {job.salary_range}
              </div>
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-border-subtle flex justify-between items-center">
            <div className="text-sm text-text-secondary truncate pr-4">
              {job.requirements.slice(0, 3).join(', ')}
              {job.requirements.length > 3 && ` +${job.requirements.length - 3} more`}
            </div>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => setShowApplicants(true)}
              className="flex items-center gap-1.5"
            >
              <Users className="h-3.5 w-3.5" />
              View Applicants
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Applicants Modal */}
      <Modal open={showApplicants} onOpenChange={setShowApplicants}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-xl">Applicants — {job.title}</DialogTitle>
            <p className="text-sm text-text-secondary mt-1">
              Candidates are sorted by their AI match score.
            </p>
          </DialogHeader>
          <ApplicantList jobId={job.id} onViewDetail={(appId) => {
            setShowApplicants(false);
            navigate(`/applicant/${appId}`);
          }} />
        </DialogContent>
      </Modal>
    </>
  );
}
