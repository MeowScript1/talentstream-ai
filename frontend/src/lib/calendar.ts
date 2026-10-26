import type { FeedJob } from '@/types/feed';

const pad = (n: number) => String(n).padStart(2, '0');

// iCalendar text values need backslash, semicolon, comma and newline escaped
const esc = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

function stamp(date: string, time: string): string {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${pad((h + 1) % 24)}:${pad(m)}`;
}

/** Download an .ics file for a posted walk-in drive. Times are "floating": they show at the venue's local time. */
export function downloadWalkinCalendar(job: FeedJob): void {
  if (!job.walkin_date || !job.walkin_start_time) return;
  const now = new Date();
  const dtstamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TalentStream//Walk-in//EN',
    'BEGIN:VEVENT',
    `UID:${job.id}@talentstream`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${stamp(job.walkin_date, job.walkin_start_time)}`,
    `DTEND:${stamp(job.walkin_date, job.walkin_end_time ?? addHour(job.walkin_start_time))}`,
    `SUMMARY:${esc(`${/^walk-?in/i.test(job.title) ? '' : 'Walk-in: '}${job.title}${job.company ? ` at ${job.company}` : ''}`)}`,
    `LOCATION:${esc(job.venue ?? '')}`,
    `DESCRIPTION:${esc(job.notes ?? 'Bring your resume and a photo ID.')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'walk-in.ics';
  link.click();
  URL.revokeObjectURL(url);
}
