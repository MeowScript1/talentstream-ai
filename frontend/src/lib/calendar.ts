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

const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** Download an .ics file for a scheduled video interview (30 minutes unless the employer says otherwise in the notes). */
export function downloadVideoInterviewCalendar(args: { id: string; title: string; company: string; start: string; url: string; notes?: string | null }): void {
  const start = new Date(args.start);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TalentStream//Video interview//EN',
    'BEGIN:VEVENT',
    `UID:${args.id}@talentstream`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${esc(`Video interview: ${args.title} at ${args.company}`)}`,
    `LOCATION:${esc(args.url)}`,
    `DESCRIPTION:${esc(`Join: ${args.url}${args.notes ? `\n${args.notes}` : ''}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'video-interview.ics';
  link.click();
  URL.revokeObjectURL(url);
}
