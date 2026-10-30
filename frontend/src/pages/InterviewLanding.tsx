import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock, Lightbulb, MessageSquare, Video } from 'lucide-react';
import { useApplicationStore } from '@/store/applicationStore';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

const TIPS = [
  'Answer in full sentences. The AI scores what you write: relevance, specifics and clarity.',
  'Think out loud. Walking through your reasoning shows how you solve problems.',
  'Take your time. A considered answer beats a rushed one.',
  'Be specific. Use real examples from your past work whenever you can.',
];

const FACTS = [
  { icon: MessageSquare, text: 'A text chat with an AI interviewer. No camera or microphone needed.' },
  { icon: CheckCircle2, text: 'Up to 5 questions, one at a time.' },
  { icon: Clock, text: 'One attempt. When the interview ends it cannot be repeated, so start when you can focus.' },
];

export default function InterviewLanding() {
  const navigate = useNavigate();
  const { myApplications, isLoading, fetchMyApplications } = useApplicationStore();

  useEffect(() => {
    fetchMyApplications();
  }, [fetchMyApplications]);

  const pendingInterviews = useMemo(
    () => myApplications.filter((a) => a.status === 'interviewing'),
    [myApplications]
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-3xl">Interview room</h1>
        <p className="mt-1 text-sm text-text-secondary sm:text-base">Interviews you have been invited to. Read how it works before you start.</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <Video className="h-5 w-5 text-secondary" />
            Invitations
          </h2>
          {!isLoading && <span className="text-sm text-text-secondary">{pendingInterviews.length} waiting</span>}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        ) : pendingInterviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-subtle bg-bg-surface px-6 py-12 text-center">
            <Video className="mx-auto mb-3 h-8 w-8 text-text-muted" />
            <h3 className="text-base font-semibold text-text-primary">No interviews yet</h3>
            <p className="mx-auto mt-1 max-w-xs text-sm text-text-secondary">
              When your resume fits a role well enough, the interview invitation appears here.
            </p>
            <Button variant="ghost" className="mt-4" onClick={() => navigate('/dashboard/candidate')}>
              Browse jobs
            </Button>
          </div>
        ) : (
          pendingInterviews.map((app) => (
            <article key={app.id} className="space-y-3 rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
              <div>
                <p className="text-sm text-text-secondary">{app.employer_name || 'Company'}</p>
                <h3 className="text-base font-semibold leading-snug text-text-primary">First-round AI interview: {app.job_title}</h3>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-bg-elevated px-3 py-2 text-sm text-text-secondary">
                <span>Up to 5 questions</span>
                <span aria-hidden="true">·</span>
                <span>Text chat</span>
                {app.ats_score != null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Resume fit <span className="font-semibold text-text-primary">{app.ats_score}/100</span>
                    </span>
                  </>
                )}
              </div>
              <Button onClick={() => navigate(`/interview/${app.id}`)} className="w-full">
                Start interview
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </article>
          ))
        )}
      </section>

      <section className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-text-primary">How it works</h2>
        <ul className="space-y-3">
          {FACTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-text-secondary">
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-secondary" />
              {text}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-text-primary">
          <Lightbulb className="h-4 w-4 text-secondary" />
          Tips
        </h2>
        <ol className="space-y-2">
          {TIPS.map((tip, i) => (
            <li key={tip} className="flex items-start gap-3 rounded-lg bg-bg-elevated p-3 text-sm text-text-primary">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-secondary-container text-xs font-semibold text-on-secondary-container">
                {i + 1}
              </span>
              {tip}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
