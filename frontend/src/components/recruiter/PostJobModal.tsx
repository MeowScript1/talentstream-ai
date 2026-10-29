import { useState } from 'react';
import { Modal, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TagInput } from '@/components/ui/TagInput';
import { useJobStore } from '@/store/jobStore';
import { JobCreate } from '@/types/job';
import toast from 'react-hot-toast';

export function PostJobModal() {
  const [open, setOpen] = useState(false);
  const { createJob } = useJobStore();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState<JobCreate>({
    title: '',
    description: '',
    requirements: [],
    location: '',
    job_type: 'full_time',
    salary_range: '',
    ats_threshold: 65,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.requirements.length === 0) {
      toast.error('Please add at least one requirement');
      return;
    }
    
    setIsLoading(true);
    try {
      await createJob(formData);
      toast.success('Job posted successfully');
      setOpen(false);
      setFormData({
        title: '', description: '', requirements: [], location: '',
        job_type: 'full_time', salary_range: '', ats_threshold: 65,
      });
    } catch {
      toast.error('Failed to post job');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Post New Job</Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-2xl">Post a New Job</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Job Title</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Senior Frontend Engineer"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Description</label>
            <textarea
              className="w-full min-h-[120px] rounded-lg border border-border-subtle bg-bg-base p-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-border-active resize-y"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the role, responsibilities, and what you're looking for..."
              required
              minLength={10}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Required Skills</label>
            <TagInput
              value={formData.requirements}
              onChange={(reqs) => setFormData({ ...formData, requirements: reqs })}
              placeholder="Type a skill and press Enter..."
            />
            <p className="text-xs text-text-muted mt-1.5">These will be used by our AI to score candidates.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Location</label>
              <Input
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Remote, New York"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Salary Range</label>
              <Input
                value={formData.salary_range || ''}
                onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })}
                placeholder="e.g. $120k - $150k"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">Job Type</label>
              <select
                className="w-full h-12 rounded-lg border border-border-subtle bg-bg-base px-4 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-active appearance-none"
                value={formData.job_type}
                onChange={(e) => setFormData({ ...formData, job_type: e.target.value as JobCreate['job_type'] })}
              >
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
                <option value="contract">Contract</option>
                <option value="remote">Remote</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">ATS Threshold ({formData.ats_threshold})</label>
              <input
                type="range"
                min="50"
                max="90"
                step="5"
                className="w-full h-12 accent-accent-primary"
                value={formData.ats_threshold}
                onChange={(e) => setFormData({ ...formData, ats_threshold: parseInt(e.target.value) })}
              />
              <p className="text-xs text-text-muted -mt-2">Minimum resume score to invite a candidate to the interview.</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={isLoading}>Post Job</Button>
          </div>
        </form>
      </DialogContent>
    </Modal>
  );
}
