import { useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, RefreshCw, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatResumeDate, validateResumeFile } from '@/lib/resume';
import { getApiError } from '@/lib/utils';
import api from '@/services/api';
import { useAuthStore, type ResumeInfo } from '@/store/authStore';

/** Where a candidate saves their resume once, so applying is one click. */
export function ResumeCard() {
  const { user, uploadResume, removeResume } = useAuthStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasResume = Boolean(user?.resume_filename);

  // The file link isn't part of the user object, so fetch it when a resume exists or changes
  useEffect(() => {
    if (!user?.resume_updated_at) {
      setViewUrl(null);
      return;
    }
    let cancelled = false;
    api
      .get<ResumeInfo>('/users/me/resume')
      .then((res) => !cancelled && setViewUrl(res.data.url))
      .catch(() => !cancelled && setViewUrl(null));
    return () => {
      cancelled = true;
    };
  }, [user?.resume_updated_at]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateResumeFile(file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setIsUploading(true);
    try {
      await uploadResume(file);
      toast.success(hasResume ? 'Resume updated ✨' : 'Resume saved! Applying is now one click ✨');
    } catch (error) {
      toast.error(getApiError(error, 'Could not upload your resume'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (!confirm('Remove your saved resume? Applications you already sent keep their copy.')) return;
    setIsRemoving(true);
    try {
      await removeResume();
      toast.success('Resume removed');
    } catch (error) {
      toast.error(getApiError(error, 'Could not remove your resume'));
    } finally {
      setIsRemoving(false);
    }
  };

  const openPicker = () => fileInputRef.current?.click();

  return (
    <Card id="resume" className="p-6 scroll-mt-24">
      <div className="flex items-center gap-3 pb-4 border-b border-border-subtle mb-5">
        <div className="h-9 w-9 rounded-xl bg-accent-muted flex items-center justify-center">
          <FileText className="h-5 w-5 text-accent-primary" />
        </div>
        <div>
          <h2 className="text-base font-bold text-text-primary">My Resume</h2>
          <p className="text-xs text-text-muted">Save it once and apply to any job in one click</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {hasResume ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="h-12 w-12 flex-shrink-0 rounded-2xl border border-accent-primary/30 bg-accent-muted flex items-center justify-center">
              <FileText className="h-6 w-6 text-accent-primary" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-text-primary">{user?.resume_filename}</p>
              {user?.resume_updated_at && (
                <p className="text-xs text-text-muted">Saved {formatResumeDate(user.resume_updated_at)}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {viewUrl && (
              <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="ghost" size="sm" className="gap-1.5">
                  <ExternalLink className="h-4 w-4" /> View
                </Button>
              </a>
            )}
            <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={openPicker} loading={isUploading}>
              {!isUploading && <RefreshCw className="h-4 w-4" />} Replace
            </Button>
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-danger" onClick={handleRemove} loading={isRemoving}>
              {!isRemoving && <Trash2 className="h-4 w-4" />} Remove
            </Button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={openPicker}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openPicker()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition-all ${
            isDragging
              ? 'scale-[1.01] border-accent-primary bg-accent-muted'
              : 'border-white/15 hover:border-accent-primary/60 hover:bg-white/[0.03]'
          }`}
        >
          <div className="mb-3 flex h-14 w-14 -rotate-6 items-center justify-center rounded-2xl bg-accent-muted">
            {isUploading ? (
              <RefreshCw className="h-6 w-6 animate-spin text-accent-primary" />
            ) : (
              <Upload className="h-6 w-6 text-accent-primary" />
            )}
          </div>
          <p className="text-sm font-bold text-text-primary">
            {isUploading ? 'Uploading…' : 'Drop your resume here'}
          </p>
          <p className="mt-1 text-xs text-text-muted">or click to browse. PDF only, up to 5MB</p>
        </div>
      )}

      <p className="mt-4 text-xs text-text-muted">
        Our AI reads the text in your PDF to match you with jobs, so export a text-based PDF (not a scan or photo).
      </p>
    </Card>
  );
}
