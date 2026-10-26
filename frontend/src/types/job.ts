// Job-related type definitions
export interface Job {
  id: string;
  employer_id: string;
  employer_name?: string;
  title: string;
  description: string;
  requirements: string[];
  location?: string | null;
  job_type: 'full_time' | 'part_time' | 'contract' | 'remote';
  salary_range?: string | null;
  status: 'open' | 'closed';
  ats_threshold: number;
  created_at: string;
  kind?: 'apply' | 'walkin';
  walkin_date?: string | null;
  walkin_end_date?: string | null;
  walkin_start_time?: string | null;
  walkin_end_time?: string | null;
  venue?: string | null;
  walkin_notes?: string | null;
}

export interface JobCreate {
  title: string;
  description: string;
  requirements: string[];
  location?: string | null;
  job_type: 'full_time' | 'part_time' | 'contract' | 'remote';
  salary_range?: string | null;
  ats_threshold: number;
  kind?: 'apply' | 'walkin';
  walkin_date?: string | null;
  walkin_end_date?: string | null;
  walkin_start_time?: string | null;
  walkin_end_time?: string | null;
  venue?: string | null;
  walkin_notes?: string | null;
}
