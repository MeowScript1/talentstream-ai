import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarPlus, CheckCircle2, Clock, Lightbulb, MessageSquare, Sparkles, Video } from 'lucide-react';
import { useApplicationStore } from '@/store/applicationStore';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { downloadVideoInterviewCalendar } from '@/lib/calendar';
import { missedMessage, missedNextStep } from '@/lib/missed';
import { meetingPath } from '@/services/video';

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

const MISSED_VISIBLE_MS = 3 * 24 * 60 * 60 * 1000; // a missed interview stays listed for three days

function describeTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
}

function startsIn(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Happening now';
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return `Starts in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Starts in ${hours} h ${minutes % 60} min`;
  const days = Math.round(hours / 24);
  return `Starts in ${days} ${days === 1 ? 'day' : 'days'}`;
}

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

  const videoInterviews = useMemo(
    () =>
      myApplications
        .filter((a) => {
          const v = a.video_interview;
          if (!v || v.state === 'completed') return false;
          // a missed one stays visible for three days so the person can see what happened
          return v.state === 'missed' ? new Date(v.scheduled_at).getTime() + MISSED_VISIBLE_MS > Date.now() : true;
        })
        .sort((a, b) => new Date(a.video_interview!.scheduled_at).getTime() - new Date(b.video_interview!.scheduled_at).getTime()),
    [myApplications]
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-3xl">Interview room</h1>
        <p className="mt-1 text-sm text-text-secondary sm:text-base">Your scheduled video interviews, AI interview invitations, and a place to practise.</p>
      </div>

      {videoInterviews.length > 0 && (
        <section className="space-y-3" aria-label="Video interviews">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <Video className="h-5 w-5 text-secondary" />
            Video interviews
          </h2>
          {videoInterviews.map((app) => {
            const v = app.video_interview!;
            if (v.state === 'missed') {
              return (
                <article key={app.id} className="space-y-2 rounded-xl border border-danger/40 bg-bg-surface p-4 shadow-sm">
                  <div>
                    <p className="text-sm text-text-secondary">{app.employer_name || 'Company'}</p>
                    <h3 className="text-base font-semibold leading-snug text-text-primary">{app.job_title}</h3>
                  </div>
                  <p className="font-semibold text-danger">Interview missed</p>
                  <p className="text-sm text-text-primary">{missedMessage('candidate', v.absent, app.employer_name || 'The employer')}</p>
                  <p className="text-sm text-text-secondary">{missedNextStep('candidate')}</p>
                </article>
              );
            }
            const opensAt = new Date(new Date(v.scheduled_at).getTime() - 10 * 60 * 1000);
            const open = Date.now() >= opensAt.getTime();
            return (
              <article key={app.id} className="space-y-3 rounded-xl border border-success/40 bg-bg-surface p-4 shadow-sm">
                <div>
                  <p className="text-sm text-text-secondary">{app.employer_name || 'Company'}</p>
                  <h3 className="text-base font-semibold leading-snug text-text-primary">{app.job_title}</h3>
                </div>
                <div className="rounded-lg bg-bg-elevated px-3 py-2 text-sm">
                  <p className="font-semibold text-text-primary">{describeTime(v.scheduled_at)}</p>
                  <p className="text-success">{startsIn(v.scheduled_at)}</p>
                  {!open && (
                    <p className="text-text-secondary">
                      The room opens at {opensAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}, 10 minutes before.
                    </p>
                  )}
                  {v.notes && <p className="mt-1 text-text-secondary">{v.notes}</p>}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link to={meetingPath(app.id)} className="flex-1">
                    <Button className="w-full">
                      <Video className="mr-1.5 h-4 w-4" />
                      {open ? 'Join video interview' : 'Open meeting page'}
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() =>
                      downloadVideoInterviewCalendar({
                        id: app.id,
                        title: app.job_title,
                        company: app.employer_name || 'Company',
                        start: v.scheduled_at,
                        url: `${window.location.origin}${meetingPath(app.id)}`,
                        notes: v.notes,
                      })
                    }
                  >
                    <CalendarPlus className="mr-1.5 h-4 w-4" />
                    Add to calendar
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <MessageSquare className="h-5 w-5 text-secondary" />
            AI interview invitations
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

      <Link
        to="/interview/practice"
        className="flex items-start gap-3 rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm hover:border-border-active"
      >
        <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-secondary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-text-primary">Practice with AI</h2>
          <p className="mt-0.5 text-sm text-text-secondary">See the kind of questions that usually come up for a role, practise your answers and get feedback. Nothing is saved.</p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-text-muted" />
      </Link>

      <section className="rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-text-primary">How the AI interview works</h2>
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
