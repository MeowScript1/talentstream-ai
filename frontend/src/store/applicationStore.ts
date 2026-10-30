import { create } from 'zustand';
import api from '@/services/api';

export interface Application {
  id: string;
  job_id: string;
  job_title: string;
  employer_name: string;
  candidate_id: string;
  candidate_name?: string;
  resume_url: string;
  ats_score?: number | null;
  ats_summary?: string | null;
  status: 'applied' | 'screening' | 'interviewing' | 'shortlisted' | 'rejected';
  created_at: string;
  video_interview?: { scheduled_at: string; meeting_url: string; notes: string | null } | null;
}

interface ApplicationState {
  myApplications: Application[];
  jobApplicants: Application[];
  isLoading: boolean;
  
  fetchMyApplications: () => Promise<void>;
  fetchJobApplicants: (jobId: string) => Promise<void>;
  /** Without a file, the backend applies with the candidate's saved resume. */
  applyToJob: (jobId: string, file?: File) => Promise<void>;
  updateApplicantStatus: (appId: string, status: Application['status']) => Promise<void>;
  rescoreApplication: (appId: string) => Promise<void>;
}

export const useApplicationStore = create<ApplicationState>((set) => ({
  myApplications: [],
  jobApplicants: [],
  isLoading: false,

  fetchMyApplications: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get('/applications/mine');
      set({ myApplications: response.data, isLoading: false });
    } catch (error) {
      console.error(error);
      set({ isLoading: false });
    }
  },

  fetchJobApplicants: async (jobId: string) => {
    set({ isLoading: true });
    try {
      const response = await api.get(`/jobs/${jobId}/applications`);
      set({ jobApplicants: response.data, isLoading: false });
    } catch (error) {
      console.error(error);
      set({ isLoading: false });
    }
  },

  applyToJob: async (jobId: string, file?: File) => {
    try {
      const formData = new FormData();
      formData.append('job_id', jobId);
      if (file) formData.append('resume', file);

      const response = await api.post('/applications', formData);
      set((state) => ({ myApplications: [response.data, ...state.myApplications] }));
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  updateApplicantStatus: async (appId: string, status: Application['status']) => {
    try {
      await api.patch(`/applications/${appId}/status`, { status });
      set((state) => ({
        jobApplicants: state.jobApplicants.map((app) => 
          app.id === appId ? { ...app, status } : app
        )
      }));
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  rescoreApplication: async (appId: string) => {
    try {
      await api.post(`/applications/${appId}/rescore`);
      // Set score to null locally to show "Processing..." state
      set((state) => ({
        jobApplicants: state.jobApplicants.map((app) =>
          app.id === appId ? { ...app, ats_score: null, ats_summary: null } : app
        )
      }));
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
}));

