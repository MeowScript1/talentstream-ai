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

export interface CompanyListings {
  total: number;
  average_trust: number;
  looks_genuine: number;
  be_careful: number;
  likely_fake: number;
  reports: number;
  sources: string[];
}

export interface CompanyOnTalentStream {
  jobs_posted: number;
  /** applications at least a week old */
  applications: number;
  decided: number;
  response_rate: number | null;
  median_days_to_decision: number | null;
}

export interface CompanyResult {
  name: string;
  listings: CompanyListings | null;
  on_talentstream: CompanyOnTalentStream | null;
}

export async function searchCompanies(q: string): Promise<CompanyResult[]> {
  const response = await api.get<{ results: CompanyResult[] }>('/feed/companies', { params: { q } });
  return response.data.results;
}

export interface MyReports {
  reports_sent: number;
  confirmed: number;
  points: number;
  points_per_confirmed: number;
  reports_needed_to_hide: number;
  rank: string;
  next_rank_at: number | null;
}

export async function fetchMyReports(): Promise<MyReports> {
  const response = await api.get<MyReports>('/feed/my-reports');
  return response.data;
}
