import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lightbulb, Target } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getApiError } from '@/lib/utils';
import { useApplicationStore } from '@/store/applicationStore';
import {
  fetchPracticeFeedback,
  fetchPracticeQuestions,
  type PracticeFeedback,
  type PracticeQuestion,
  type PracticeQuestions,
} from '@/services/practice';

function QuestionCard({ role, item, index }: { role: string; item: PracticeQuestion; index: number }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);

  const submit = async () => {
    setError('');
    if (answer.trim().length < 10) {
      setError('Write a few sentences first.');
      return;
    }
    setLoading(true);
    try {
      setFeedback(await fetchPracticeFeedback(role, item.question, answer.trim()));
    } catch (err) {
      setError(getApiError(err, "Couldn't get feedback just now."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <article className="space-y-3 rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm">
      <h3 className="flex gap-3 text-base font-semibold leading-snug text-text-primary">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-secondary-container text-xs font-semibold text-on-secondary-container">
          {index + 1}
        </span>
        {item.question}
      </h3>
      {item.why && (
        <p className="flex gap-2 text-sm text-text-secondary">
          <Target className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            <span className="font-semibold text-text-primary">What they check:</span> {item.why}
          </span>
        </p>
      )}
      {item.tip && (
        <p className="flex gap-2 text-sm text-text-secondary">
          <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-secondary" />
          <span>
            <span className="font-semibold text-text-primary">How to answer:</span> {item.tip}
          </span>
        </p>
      )}

      {!open ? (
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Practise this answer
        </Button>
      ) : (
        <div className="space-y-2">
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={2000}
            rows={5}
            placeholder="Type your answer as you would say it in the interview"
            className="w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
            aria-label={`Your answer to: ${item.question}`}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={submit} loading={loading}>
              {feedback ? 'Get feedback again' : 'Get feedback'}
            </Button>
            <span className="text-xs text-text-muted">{answer.length}/2000</span>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}

      {feedback && (
        <div className="space-y-3 rounded-lg border border-border-subtle bg-bg-elevated p-3 text-sm">
          {feedback.went_well.length > 0 && (
            <div>
              <p className="font-semibold text-success">What went well</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-text-primary">
                {feedback.went_well.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {feedback.improve.length > 0 && (
            <div>
              <p className="font-semibold text-warning">To improve</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-text-primary">
                {feedback.improve.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {feedback.stronger_answer && (
            <div>
              <p className="font-semibold text-text-primary">A stronger answer could go like this</p>
              <p className="mt-1 text-text-secondary">{feedback.stronger_answer}</p>
            </div>
          )}
          <p className="text-xs text-text-muted">AI feedback is a guide, not a score. It is not saved and employers never see it.</p>
        </div>
      )}
    </article>
  );
}

export default function InterviewPractice() {
  const { myApplications, fetchMyApplications } = useApplicationStore();
  const [role, setRole] = useState('');
  const [asked, setAsked] = useState('');
  const [result, setResult] = useState<PracticeQuestions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMyApplications();
  }, [fetchMyApplications]);

  // Roles the candidate applied for are one tap away
  const suggestions = useMemo(() => [...new Set(myApplications.map((a) => a.job_title))].slice(0, 3), [myApplications]);

  const load = async (chosen: string) => {
    const wanted = chosen.trim();
    if (wanted.length < 2) {
      setError('Enter the role you are preparing for.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      setResult(await fetchPracticeQuestions(wanted));
      setAsked(wanted);
    } catch (err) {
      setError(getApiError(err, "Couldn't load questions just now."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      <div>
        <Link to="/interview" className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-text-secondary hover:text-text-primary">
          <ArrowLeft className="h-4 w-4" /> Interview room
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-3xl">Practice interview</h1>
        <p className="mt-1 text-sm text-text-secondary sm:text-base">
          See the kind of questions that usually come up for a role, then practise your answers. Nothing here is saved or shown to employers.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(role);
        }}
        className="space-y-3 rounded-xl border border-border-subtle bg-bg-surface p-4 shadow-sm"
      >
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-text-primary">Which role are you preparing for?</span>
          <Input value={role} maxLength={100} onChange={(e) => setRole(e.target.value)} placeholder="For example: Customer support executive" />
        </label>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Roles you applied for">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setRole(s);
                  load(s);
                }}
                className="min-h-10 rounded-md border border-border-subtle bg-bg-surface px-3 text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <Button type="submit" loading={loading} className="w-full sm:w-auto">
          Show likely questions
        </Button>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </form>

      {result && (
        <section className="space-y-3">
          <p className="rounded-lg border border-border-subtle bg-bg-elevated p-3 text-sm text-text-secondary">
            {result.source === 'ai'
              ? `Typical questions for "${asked}". These are common for the role, not a promise of what any company will ask.`
              : 'These are general interview questions that suit most jobs. Questions written for your specific role are not available right now.'}
          </p>
          {result.questions.map((q, i) => (
            <QuestionCard key={`${asked}-${q.question}`} role={asked} item={q} index={i} />
          ))}
        </section>
      )}
    </div>
  );
}
