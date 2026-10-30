import api from '@/services/api';

export interface VideoInterview {
  scheduled_at: string;
  meeting_url: string;
  notes: string | null;
}

export async function fetchVideoInterview(applicationId: string): Promise<VideoInterview | null> {
  return (await api.get<VideoInterview | null>(`/applications/${applicationId}/video-interview`)).data;
}

export async function scheduleVideoInterview(
  applicationId: string,
  body: { scheduled_at: string; meeting_url: string; notes?: string }
): Promise<VideoInterview> {
  return (await api.put<VideoInterview>(`/applications/${applicationId}/video-interview`, body)).data;
}

export async function cancelVideoInterview(applicationId: string): Promise<void> {
  await api.delete(`/applications/${applicationId}/video-interview`);
}

/** "Google Meet", "Zoom"... from the link, so the button says what it opens. */
export function providerName(url: string): string {
  try {
    const host = new URL(url).hostname;
    if (host.endsWith('meet.google.com')) return 'Google Meet';
    if (host.endsWith('zoom.us')) return 'Zoom';
    if (host.endsWith('teams.microsoft.com') || host.endsWith('teams.live.com')) return 'Microsoft Teams';
    if (host.endsWith('whereby.com')) return 'Whereby';
  } catch {
    // fall through
  }
  return 'meeting';
}
