import api from '@/services/api';
import type { FeedPage, FeedQuery } from '@/types/feed';

export async function fetchFeed(query: FeedQuery): Promise<FeedPage> {
  const params: Record<string, string | number | boolean> = { kind: query.kind, page: query.page ?? 1, limit: query.limit ?? 20 };
  if (query.q?.trim()) params.q = query.q.trim();
  if (query.location?.trim()) params.location = query.location.trim();
  if (query.remote !== undefined) params.remote = query.remote;
  if (query.include_risky) params.include_risky = true;
  const response = await api.get<FeedPage>('/feed/jobs', { params });
  return response.data;
}

export async function reportFeedJob(jobId: string, reason?: string): Promise<{ reported: boolean; hidden: boolean }> {
  const response = await api.post(`/feed/jobs/${jobId}/report`, { reason: reason || null });
  return response.data;
}

export interface FeedStats {
  apply_jobs: number;
  walkin_jobs_next_7_days: number;
  syncing: boolean;
}

export async function fetchFeedStats(): Promise<FeedStats> {
  const response = await api.get<FeedStats>('/feed/stats');
  return response.data;
}
