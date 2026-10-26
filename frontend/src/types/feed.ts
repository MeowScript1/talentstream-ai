export type TrustLabel = 'looks_good' | 'be_careful' | 'likely_scam';
export type FeedKind = 'apply' | 'walkin';

export interface TrustReason {
  code: string;
  text: string;
  impact: number;
}

export interface FeedJob {
  id: string;
  source: string;
  source_label: string;
  title: string;
  company: string | null;
  location: string | null;
  remote: boolean | null;
  snippet: string;
  url: string;
  salary_text: string | null;
  tags: string[];
  posted_at: string | null;
  kind: FeedKind;
  walkin_date: string | null;
  walkin_time: string | null;
  venue: string | null;
  trust_score: number;
  trust_label: TrustLabel;
  trust_reasons: TrustReason[];
}

export interface FeedSource {
  name: string;
  label: string;
  url: string;
}

export interface FeedPage {
  items: FeedJob[];
  total: number;
  page: number;
  limit: number;
  hidden_risky: number;
  updated_at: string | null;
  syncing: boolean;
  sources: FeedSource[];
}

export interface FeedQuery {
  kind: FeedKind;
  q?: string;
  location?: string;
  remote?: boolean;
  include_risky?: boolean;
  page?: number;
  limit?: number;
}
