import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Briefcase, MapPin, DollarSign, Sliders, Tag, FileText, ChevronRight, Footprints, Laptop, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TagInput } from '@/components/ui/TagInput';
import { useJobStore } from '@/store/jobStore';
import { JobCreate } from '@/types/job';
import toast from 'react-hot-toast';
import { cn, getApiError } from '@/lib/utils';

const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  remote: 'Remote',
};

export default function PostJob() {
  const navigate = useNavigate();
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
    kind: 'apply',
    walkin_date: '',
    walkin_end_date: '',
    walkin_start_time: '',
    walkin_end_time: '',
    venue: '',
    walkin_notes: '',
  });
  const isWalkin = formData.kind === 'walkin';
  const todayIso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const update = <K extends keyof JobCreate>(field: K, value: JobCreate[K]) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return toast.error('Job title is required');
    if (!formData.description.trim() || formData.description.length < 10)
      return toast.error('Description must be at least 10 characters');
    if (formData.requirements.length === 0)
      return toast.error(isWalkin ? 'Add at least one skill or role requirement' : 'Add at least one required skill');

    if (isWalkin) {
      if (!formData.walkin_date) return toast.error('Pick the walk-in date');
      if (formData.walkin_date < todayIso) return toast.error("The walk-in date can't be in the past");
      if (formData.walkin_end_date && formData.walkin_end_date < formData.walkin_date)
        return toast.error("The last day can't be before the first day");
      if (!formData.walkin_start_time) return toast.error('Add the start time');
      if (formData.walkin_end_time && formData.walkin_end_time <= formData.walkin_start_time)
        return toast.error('The end time must be after the start time');
      if ((formData.venue ?? '').trim().length < 8) return toast.error('Give the full venue address so candidates can find it');
    }

    // Empty optional inputs become null; an online job carries no walk-in details at all
    const blank = (v?: string | null) => (v && v.trim() ? v : null);
    const payload: JobCreate = {
      ...formData,
      walkin_date: isWalkin ? blank(formData.walkin_date) : null,
      walkin_end_date: isWalkin ? blank(formData.walkin_end_date) : null,
      walkin_start_time: isWalkin ? blank(formData.walkin_start_time) : null,
      walkin_end_time: isWalkin ? blank(formData.walkin_end_time) : null,
      venue: isWalkin ? blank(formData.venue) : null,
      walkin_notes: isWalkin ? blank(formData.walkin_notes) : null,
    };

    setIsLoading(true);
    try {
      await createJob(payload);
      toast.success(isWalkin ? 'Walk-in drive posted! 🎉' : 'Job posted successfully! 🎉');
      navigate('/dashboard/recruiter');
    } catch (error) {
      // Show the server's reason (e.g. "can't ask candidates for money") instead of a generic message
      toast.error(getApiError(error, 'Failed to post job. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-1"
      >
        <div className="flex items-center gap-2 text-sm text-text-muted mb-3">
          <button
            onClick={() => navigate('/dashboard/recruiter')}
            className="-my-3 py-3 hover:text-text-secondary transition-colors"
          >
            Dashboard
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-text-primary">Post a Job</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">Post a New Position</h1>
        <p className="text-text-secondary">
          Fill in the details below. For online jobs our AI uses them to screen and match candidates automatically.
        </p>
      </motion.div>

      <form onSubmit={handleSubmit}>
        <motion.div
          className="space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {/* How will candidates join? */}
          <motion.div
            variants={itemVariants}
            className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-card space-y-4"
          >
            <div>
              <h2 className="text-base font-semibold text-text-primary">How will candidates join?</h2>
              <p className="text-xs text-text-muted">Pick one. You can post the other kind separately.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ['apply', Laptop, 'Apply online', 'Candidates apply with their resume. Our AI scores them and invites the best to an interview.'],
                ['walkin', Footprints, 'Walk-in drive', 'Candidates just turn up on the day. It shows in the Walk-in tab for the 7 days before.'],
              ] as const).map(([value, Icon, title, blurb]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => update('kind', value)}
                  aria-pressed={formData.kind === value}
                  className={cn(
                    'rounded-2xl border p-4 text-left transition-all',
                    formData.kind === value
                      ? 'border-accent-primary bg-accent-muted shadow-glow'
                      : 'border-border-subtle hover:border-white/25'
                  )}
                >
                  <Icon className={cn('mb-2 h-5 w-5', formData.kind === value ? 'text-accent-primary' : 'text-text-muted')} />
                  <p className="font-bold text-text-primary">{title}</p>
                  <p className="mt-1 text-xs text-text-secondary">{blurb}</p>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Basic Info Section */}
          <motion.div
            variants={itemVariants}
            className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-card space-y-5"
          >
            <div className="flex items-center gap-3 pb-4 border-b border-border-subtle">
              <div className="h-9 w-9 rounded-lg bg-accent-muted flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-accent-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">Basic Information</h2>
                <p className="text-xs text-text-muted">Core details about the position</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Job Title <span className="text-danger">*</span>
              </label>
              <Input
                value={formData.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Job Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['full_time', 'part_time', 'contract', 'remote'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => update('job_type', type)}
                      className={`min-h-11 md:min-h-0 px-3 py-2 rounded-2xl text-xs font-medium border transition-all duration-150 ${
                        formData.job_type === type
                          ? 'bg-accent-muted border-accent-primary text-accent-primary shadow-active'
                          : 'bg-bg-base border-border-subtle text-text-secondary hover:border-border-active hover:text-text-primary'
                      }`}
                    >
                      {JOB_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    <MapPin className="inline h-3.5 w-3.5 mr-1" />Location
                  </label>
                  <Input
                    value={formData.location || ''}
                    onChange={(e) => update('location', e.target.value)}
                    placeholder="e.g. Remote, New York, London"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    <DollarSign className="inline h-3.5 w-3.5 mr-1" />Salary Range
                  </label>
                  <Input
                    value={formData.salary_range || ''}
                    onChange={(e) => update('salary_range', e.target.value)}
                    placeholder="e.g. $120k – $150k / year"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Description Section */}
          <motion.div
            variants={itemVariants}
            className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-card space-y-5"
          >
            <div className="flex items-center gap-3 pb-4 border-b border-border-subtle">
              <div className="h-9 w-9 rounded-lg bg-accent-muted flex items-center justify-center">
                <FileText className="h-5 w-5 text-accent-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">Job Description</h2>
                <p className="text-xs text-text-muted">Describe the role, responsibilities and expectations</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-medium text-text-secondary">
                  Description <span className="text-danger">*</span>
                </label>
                <span className={`text-xs ${formData.description.length < 10 ? 'text-danger' : 'text-text-muted'}`}>
                  {formData.description.length} chars {formData.description.length < 10 ? '(min 10)' : ''}
                </span>
              </div>
              <textarea
                className="w-full min-h-[180px] rounded-2xl border border-border-subtle bg-bg-base p-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-border-active resize-y transition-colors"
                value={formData.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Describe the role, what the candidate will be working on, the team culture, growth opportunities, and what you're looking for in an ideal candidate..."
                required
                minLength={10}
              />
            </div>
          </motion.div>

          {/* Walk-in details */}
          {isWalkin && (
            <motion.div
              variants={itemVariants}
              className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-card space-y-5"
            >
              <div className="flex items-center gap-3 pb-4 border-b border-border-subtle">
                <div className="h-9 w-9 rounded-lg bg-accent-muted flex items-center justify-center">
                  <CalendarDays className="h-5 w-5 text-accent-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Walk-in details</h2>
                  <p className="text-xs text-text-muted">Everything a candidate needs to turn up</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    First day <span className="text-danger">*</span>
                  </label>
                  <Input type="date" min={todayIso} value={formData.walkin_date ?? ''} onChange={(e) => update('walkin_date', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Last day (if it runs several days)</label>
                  <Input
                    type="date"
                    min={formData.walkin_date || todayIso}
                    value={formData.walkin_end_date ?? ''}
                    onChange={(e) => update('walkin_end_date', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    From <span className="text-danger">*</span>
                  </label>
                  <Input type="time" value={formData.walkin_start_time ?? ''} onChange={(e) => update('walkin_start_time', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Until</label>
                  <Input type="time" value={formData.walkin_end_time ?? ''} onChange={(e) => update('walkin_end_time', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Venue address <span className="text-danger">*</span>
                </label>
                <Input
                  value={formData.venue ?? ''}
                  onChange={(e) => update('venue', e.target.value)}
                  placeholder="e.g. Plot 12, Hitech City, Hyderabad 500081"
                  maxLength={500}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">What to bring / who to ask for</label>
                <Input
                  value={formData.walkin_notes ?? ''}
                  onChange={(e) => update('walkin_notes', e.target.value)}
                  placeholder="e.g. Resume and photo ID. Ask for HR at reception."
                  maxLength={1000}
                />
              </div>

              <p className="text-xs text-text-muted">
                Never ask candidates to pay anything. Posts that mention registration fees, deposits or kits are rejected.
              </p>
            </motion.div>
          )}

          {/* Requirements Section */}
          <motion.div
            variants={itemVariants}
            className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-card space-y-5"
          >
            <div className="flex items-center gap-3 pb-4 border-b border-border-subtle">
              <div className="h-9 w-9 rounded-lg bg-accent-muted flex items-center justify-center">
                <Tag className="h-5 w-5 text-accent-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">Required Skills</h2>
                <p className="text-xs text-text-muted">These are fed directly into our AI to score resumes</p>
              </div>
            </div>

            <div>
              <TagInput
                value={formData.requirements}
                onChange={(reqs) => update('requirements', reqs)}
                placeholder="Type a skill and press Enter (e.g. React, TypeScript, Node.js)"
              />
              {formData.requirements.length > 0 && (
                <p className="text-xs text-text-muted mt-2">
                  {formData.requirements.length} skill{formData.requirements.length !== 1 ? 's' : ''} added
                </p>
              )}
            </div>
          </motion.div>

          {/* AI Settings Section (online jobs only: a walk-in has no applications to screen) */}
          {!isWalkin && (
          <motion.div
            variants={itemVariants}
            className="bg-bg-surface border border-border-subtle rounded-2xl p-6 shadow-card space-y-5"
          >
            <div className="flex items-center gap-3 pb-4 border-b border-border-subtle">
              <div className="h-9 w-9 rounded-lg bg-accent-muted flex items-center justify-center">
                <Sliders className="h-5 w-5 text-accent-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text-primary">AI Screening Settings</h2>
                <p className="text-xs text-text-muted">Control how strictly AI filters candidates</p>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-text-secondary">
                  ATS Score Threshold
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-accent-primary">{formData.ats_threshold}</span>
                  <span className="text-sm text-text-muted">/ 100</span>
                </div>
              </div>

              <div className="relative">
                <input
                  type="range"
                  min="50"
                  max="90"
                  step="5"
                  className="w-full h-2 rounded-full appearance-none bg-bg-elevated cursor-pointer accent-accent-primary"
                  value={formData.ats_threshold}
                  onChange={(e) => update('ats_threshold', parseInt(e.target.value))}
                />
                <div className="flex justify-between text-xs text-text-muted mt-2">
                  <span>50 (Lenient)</span>
                  <span>70 (Balanced)</span>
                  <span>90 (Strict)</span>
                </div>
              </div>

              <div className="mt-4 p-4 rounded-2xl bg-bg-elevated border border-border-subtle">
                <p className="text-sm text-text-secondary">
                  Candidates with an AI resume match score{' '}
                  <span className="text-accent-primary font-semibold">above {formData.ats_threshold}</span>{' '}
                  will automatically be invited to the AI interview stage.
                  {formData.ats_threshold >= 80
                    ? ' This is a high bar — only top candidates will proceed.'
                    : formData.ats_threshold <= 55
                    ? ' This is lenient — most candidates will reach the interview stage.'
                    : ' This is a balanced threshold.'}
                </p>
              </div>
            </div>
          </motion.div>
          )}

          {/* Submit Row */}
          <motion.div
            variants={itemVariants}
            className="flex items-center justify-between pt-2"
          >
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/dashboard/recruiter')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={isLoading}
              className="px-8"
              size="lg"
            >
              {isWalkin ? 'Post walk-in drive →' : 'Post Job →'}
            </Button>
          </motion.div>
        </motion.div>
      </form>
    </div>
  );
}
