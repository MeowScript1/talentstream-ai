export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

/** Quick client-side check so people get instant feedback. The server re-checks everything. */
export function validateResumeFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.pdf')) return 'Only PDF files are accepted';
  if (file.size > MAX_RESUME_BYTES) return 'File size must be under 5MB';
  return null;
}

export function formatResumeDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
