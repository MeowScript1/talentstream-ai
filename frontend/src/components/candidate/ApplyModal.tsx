import { useRef, useState } from 'react';
import { Modal, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Job } from '@/types/job';
import { useApplicationStore } from '@/store/applicationStore';
import { useAuthStore } from '@/store/authStore';
import { Upload, FileText, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiError } from '@/lib/utils';
import { formatResumeDate, validateResumeFile } from '@/lib/resume';

interface ApplyModalProps {
  job: Job;
  trigger: React.ReactNode;
  onSuccess?: () => void;
}

export function ApplyModal({ job, trigger, onSuccess }: ApplyModalProps) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { applyToJob } = useApplicationStore();
  const user = useAuthStore((s) => s.user);

  // Candidates with a saved resume apply with it by default, or choose to upload another file
  const savedResume = user?.resume_filename ?? null;
  const [useSaved, setUseSaved] = useState(true);
  const usingSaved = Boolean(savedResume) && useSaved;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSet(file);
  };

  const validateAndSet = (file: File) => {
    const problem = validateResumeFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSet(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usingSaved && !selectedFile) {
      toast.error('Please select your resume PDF');
      return;
    }

    setIsLoading(true);
    try {
      // No file => the backend applies with the saved resume
      await applyToJob(job.id, usingSaved ? undefined : (selectedFile ?? undefined));
      toast.success('Application submitted! AI is now reviewing your resume.');
      setOpen(false);
      setSelectedFile(null);
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

      <DialogContent className="max-w-lg">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl">Apply for Position</DialogTitle>
          <p className="text-sm text-text-secondary mt-1">
            <span className="font-semibold text-text-primary">{job.title}</span>
            {job.employer_name && <> · {job.employer_name}</>}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Info banner */}
          <div className="bg-accent-muted border border-accent-primary/20 rounded-2xl p-4 text-sm text-text-secondary">
            <p className="font-medium text-text-primary mb-1">How it works</p>
            <ol className="list-decimal pl-4 space-y-1 text-xs">
              <li>{usingSaved ? 'We use your saved resume' : 'Upload your resume PDF'}</li>
              <li>Our AI instantly scores your match for this role</li>
              <li>If you score ≥ {job.ats_threshold}, you'll be invited to an AI interview</li>
            </ol>
          </div>

          {/* Saved resume choice */}
          {savedResume && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setUseSaved(true)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                  useSaved ? 'border-accent-primary/60 bg-accent-muted' : 'border-white/10 hover:border-white/25'
                }`}
              >
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${useSaved ? 'bg-accent-primary text-bg-base' : 'bg-white/10 text-text-muted'}`}>
                  {useSaved ? <Check className="h-5 w-5" strokeWidth={3} /> : <FileText className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-text-primary">Use my saved resume</p>
                  <p className="truncate text-xs text-text-muted">
                    {savedResume}
                    {user?.resume_updated_at && <> · saved {formatResumeDate(user.resume_updated_at)}</>}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setUseSaved(false)}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                  !useSaved ? 'border-accent-primary/60 bg-accent-muted' : 'border-white/10 hover:border-white/25'
                }`}
              >
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${!useSaved ? 'bg-accent-primary text-bg-base' : 'bg-white/10 text-text-muted'}`}>
                  {!useSaved ? <Check className="h-5 w-5" strokeWidth={3} /> : <Upload className="h-5 w-5" />}
                </div>
                <p className="text-sm font-bold text-text-primary">Upload a different one for this job</p>
              </button>
            </div>
          )}

          {!usingSaved && (
            <>
          {/* Upload area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all ${
              isDragging
                ? 'border-accent-primary bg-accent-muted scale-[1.01]'
                : selectedFile
                ? 'border-success/50 bg-success/5'
                : 'border-border-subtle hover:border-accent-primary/50 hover:bg-bg-elevated'
            }`}
          >
            {selectedFile ? (
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-10 bg-success/10 border border-success/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{selectedFile.name}</p>
                  <p className="text-xs text-text-muted">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                  className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="h-14 w-14 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center mb-3">
                  <Upload className="h-6 w-6 text-text-muted" />
                </div>
                <p className="text-sm font-medium text-text-primary mb-1">Drop your resume here</p>
                <p className="text-xs text-text-muted">or click to browse — PDF only, max 5MB</p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileChange}
          />
            </>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-border-subtle">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isLoading} disabled={!usingSaved && !selectedFile}>
              Submit Application
            </Button>
          </div>
        </form>
      </DialogContent>
    </Modal>
  );
}
