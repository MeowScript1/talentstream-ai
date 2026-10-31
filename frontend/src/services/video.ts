import api from '@/services/api';

export interface VideoInterview {
  scheduled_at: string;
  notes: string | null;
}

export interface MeetingDetails {
  job_title: string;
  other_name: string;
  role: 'candidate' | 'employer';
  scheduled_at: string;
  notes: string | null;
  opens_at: string;
  closes_at: string;
  can_join_now: boolean;
  ice_servers: RTCIceServer[];
}

export async function fetchVideoInterview(applicationId: string): Promise<VideoInterview | null> {
  return (await api.get<VideoInterview | null>(`/applications/${applicationId}/video-interview`)).data;
}

export async function scheduleVideoInterview(applicationId: string, body: { scheduled_at: string; notes?: string }): Promise<VideoInterview> {
  return (await api.put<VideoInterview>(`/applications/${applicationId}/video-interview`, body)).data;
}

export async function cancelVideoInterview(applicationId: string): Promise<void> {
  await api.delete(`/applications/${applicationId}/video-interview`);
}

export interface VideoConflict {
  candidate_name: string;
  job_title: string;
  scheduled_at: string;
}

/** Other interviews of the same company that would overlap this time (a warning only). */
export async function fetchVideoConflicts(applicationId: string, scheduledAtIso: string): Promise<VideoConflict[]> {
  const response = await api.get<{ conflicts: VideoConflict[] }>(`/applications/${applicationId}/video-interview/conflicts`, {
    params: { scheduled_at: scheduledAtIso },
  });
  return response.data.conflicts;
}

export async function fetchMeeting(applicationId: string): Promise<MeetingDetails> {
  return (await api.get<MeetingDetails>(`/meetings/${applicationId}`)).data;
}

/** The meeting room opens 10 minutes before the start, so the calendar link and the Join button both point here. */
export function meetingPath(applicationId: string): string {
  return `/meeting/${applicationId}`;
}
