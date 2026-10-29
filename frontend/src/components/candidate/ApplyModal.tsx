import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Job } from '@/types/job';
import { useApplicationStore } from '@/store/applicationStore';
import { useAuthStore } from '@/store/authStore';
import { getApiError } from '@/lib/utils';
import { formatResumeDate } from '@/lib/resume';

interface ApplyModalProps {
  job: Job;
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

/**
 * Applying uses the resume saved on the Profile page. Uploading happens in one place only
 * (Profile), so this pop-up just confirms which resume will be sent.
 */
export function ApplyModal({ job, trigger, onSuccess }: ApplyModalProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { applyToJob } = useApplicationStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const savedResume = user?.resume_filename ?? null;

  const goToProfile = () => {
    setOpen(false);
    navigate('/profile#resume');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedResume) return;

    setIsLoading(true);
    try {
      await applyToJob(job.id);
      toast.success('Application submitted! AI is now reviewing your resume.');
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      const msg = getApiError(error, 'Failed to submit application');
      if (msg.includes('already applied')) {
        toast.error('You have already applied to this position');
      } else {
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader className="mb-5">
          <DialogTitle className="text-lg">Apply for Position</DialogTitle>
          <p className="text-sm text-text-secondary mt-1">
            <span className="font-semibold text-text-primary">{job.title}</span>
            {job.employer_name && <> · {job.employer_name}</>}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-accent-muted border border-accent-primary/20 rounded-lg p-4 text-sm text-text-secondary">
            <p className="font-medium text-text-primary mb-1">How it works</p>
            <ol className="list-decimal pl-4 space-y-1 text-xs">
              <li>We send the resume saved on your profile</li>
              <li>Our AI instantly scores your match for this role</li>
              <li>If you score ≥ {job.ats_threshold}, you'll be invited to an AI interview</li>
            </ol>
          </div>

          {savedResume ? (
            <div className="flex items-center gap-3 rounded-lg border border-accent-primary/40 bg-white/[0.03] p-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent-muted">
                <FileText className="h-5 w-5 text-accent-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-text-primary">{savedResume}</p>
                {user?.resume_updated_at && (
                  <p className="text-xs text-text-muted">Saved {formatResumeDate(user.resume_updated_at)}</p>
                )}
              </div>
              <button
                type="button"
                onClick={goToProfile}
                className="flex-shrink-0 px-1 py-3 text-xs font-bold text-accent-primary hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-center">
              <p className="text-sm font-bold text-text-primary">Add your resume first</p>
              <p className="mt-1 text-xs text-text-secondary">
                Upload it once on your Profile and every application uses it.
              </p>
              <Button type="button" size="sm" className="mt-3" onClick={goToProfile}>
                Go to Profile
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-border-subtle">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isLoading} disabled={!savedResume}>
              Submit Application
            </Button>
          </div>
        </form>
      </DialogContent>
    </Modal>
  );
}
