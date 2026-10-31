import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Video } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { getApiError } from '@/lib/utils';
import { cancelVideoInterview, fetchVideoInterview, meetingPath, scheduleVideoInterview, type VideoInterview } from '@/services/video';

/** "2026-11-03T10:30" for a datetime-local box, in the viewer's own time zone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function describe(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function ScheduleVideoCard({ applicationId, candidateName }: { applicationId: string; candidateName: string }) {
  const [current, setCurrent] = useState<VideoInterview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [when, setWhen] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchVideoInterview(applicationId)
      .then((v) => {
        setCurrent(v);
        if (v) {
          setWhen(toLocalInput(v.scheduled_at));
          setNotes(v.notes ?? '');
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [applicationId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!when) {
      setError('Choose a date and time.');
      return;
    }
    setSaving(true);
    try {
      const saved = await scheduleVideoInterview(applicationId, {
        scheduled_at: new Date(when).toISOString(),
        notes: notes.trim() || undefined,
      });
      setCurrent(saved);
      setEditing(false);
      toast.success('Video interview scheduled. The candidate can see it now.');
    } catch (err) {
      setError(getApiError(err, 'Could not schedule the interview'));
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (!confirm('Cancel this video interview? The candidate will no longer see it.')) return;
    try {
      await cancelVideoInterview(applicationId);
      setCurrent(null);
      setWhen('');
      setNotes('');
      toast.success('Video interview cancelled');
    } catch (err) {
      toast.error(getApiError(err, 'Could not cancel'));
    }
  };

  if (!loaded) return null;
  const showForm = editing || !current;

  return (
    <Card className="p-4 sm:p-6">
      <h3 className="mb-1 flex items-center gap-2 font-semibold text-text-primary">
        <Video className="h-4 w-4 text-secondary" /> Video interview
      </h3>

      {current && !editing && (
        <div className="space-y-3 text-sm">
          <p className="text-text-primary">
            <span className="font-semibold">{describe(current.scheduled_at)}</span>
          </p>
          <p className="text-text-secondary">The meeting room is on TalentStream. It opens for both of you 10 minutes before the start.</p>
          {current.notes && <p className="text-text-secondary">{current.notes}</p>}
          <div className="flex flex-wrap gap-2">
            <Link to={meetingPath(applicationId)}>
              <Button size="sm">Open meeting room</Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Change
            </Button>
            <Button size="sm" variant="outline" onClick={cancel}>
              Cancel interview
            </Button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="space-y-3 text-sm">
          <p className="text-text-secondary">
            Pick a time with {candidateName}. The video call happens inside TalentStream, so there is no link to paste.
          </p>
          <label className="block">
            <span className="mb-1 block font-semibold text-text-secondary">Date and time</span>
            <Input type="datetime-local" value={when} min={toLocalInput(new Date().toISOString())} onChange={(e) => setWhen(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold text-text-secondary">Note for the candidate (optional)</span>
            <Input value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder="For example: have your portfolio ready" />
          </label>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={saving}>
              {current ? 'Save changes' : 'Schedule video interview'}
            </Button>
            {current && (
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Keep as is
              </Button>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}
