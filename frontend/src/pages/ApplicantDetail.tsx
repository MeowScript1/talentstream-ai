import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApplicationStore } from '@/store/applicationStore';
import { TranscriptView } from '@/components/recruiter/TranscriptView';
import { ScheduleVideoCard } from '@/components/recruiter/ScheduleVideoCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ChevronLeft, FileText, Check, X, Bot, PlayCircle, User, RotateCw } from 'lucide-react';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface ApplicationDetail {
  id: string;
  job_id: string;
  job_title: string;
  employer_name: string;
  candidate_id: string;
  candidate_name: string;
  resume_url: string;
  ats_score?: number | null;
  ats_summary?: string | null;
  status: 'applied' | 'screening' | 'interviewing' | 'shortlisted' | 'rejected';
  created_at: string;
}

interface InterviewDetail {
  id: string;
  status: 'pending' | 'in_progress' | 'completed';
  transcript: { role: 'ai' | 'user'; content: string }[];
  ai_score?: number | null;
  ai_feedback?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export default function ApplicantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateApplicantStatus } = useApplicationStore();
  
  const [applicant, setApplicant] = useState<ApplicationDetail | null>(null);
  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isRescoring, setIsRescoring] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const appRes = await api.get(`/applications/${id}`);
        setApplicant(appRes.data);

        // Try to fetch the interview, which may not exist yet
        try {
          const intRes = await api.get(`/interviews/${id}`);
          setInterview(intRes.data);
        } catch {
          // The interview may not have started yet
          setInterview(null);
        }
      } catch (error) {
        console.error(error);
        toast.error('Failed to load applicant details');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDetails();
  }, [id]);

  const handleStatusUpdate = async (newStatus: ApplicationDetail['status']) => {
    if (!applicant) return;
    setIsUpdating(newStatus);
    try {
      await updateApplicantStatus(applicant.id, newStatus);
      setApplicant((prev) => prev ? { ...prev, status: newStatus } : null);
      toast.success(`Candidate ${newStatus === 'shortlisted' ? 'shortlisted' : 'rejected'} successfully`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRescore = async () => {
    if (!applicant) return;
    setIsRescoring(true);
    try {
      await api.post(`/applications/${applicant.id}/rescore`);
      setApplicant((prev) => prev ? { ...prev, ats_score: null, ats_summary: null } : null);
      toast.success('Re-scoring started. Results will update shortly');
      // Poll for updated score after a short delay
      setTimeout(async () => {
        try {
          const appRes = await api.get(`/applications/${applicant.id}`);
          setApplicant(appRes.data);
        } catch { /* ignore */ }
      }, 5000);
    } catch {
      toast.error('Failed to start re-scoring');
    } finally {
      setIsRescoring(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <div className="flex flex-col md:flex-row gap-6">
          <Skeleton className="h-96 w-full md:w-1/3" />
          <Skeleton className="h-96 w-full md:w-2/3" />
        </div>
      </div>
    );
  }

  if (!applicant) return (
    <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
      <p className="text-lg">Applicant not found</p>
      <Button variant="ghost" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Button variant="ghost" className="-ml-4 mb-2 text-text-secondary" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4 mr-1" /> Back to Dashboard
      </Button>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Column - Applicant Overview */}
        <div className="w-full md:w-1/3 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-accent-muted border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
                <User className="h-6 w-6 text-accent-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary">{applicant.candidate_name || 'Candidate'}</h2>
                <p className="text-sm text-text-secondary">Applied for {applicant.job_title}</p>
              </div>
            </div>
            
            <div className="space-y-0 divide-y divide-border-subtle">
              <div className="flex justify-between items-center py-3">
                <span className="text-sm text-text-secondary">ATS Match Score</span>
                <div className="flex items-center gap-2">
                  <Badge variant={applicant.ats_score && applicant.ats_score > 75 ? 'shortlisted' : 'screening'}>
                    {applicant.ats_score != null ? `${applicant.ats_score}/100` : 'Processing...'}
                  </Badge>
                  <button
                    onClick={handleRescore}
                    disabled={isRescoring}
                    title="Re-score with AI"
                    className="h-11 w-11 md:h-7 md:w-7 flex items-center justify-center rounded-full border border-border-subtle text-text-secondary hover:text-accent-primary hover:border-accent-primary/40 transition-colors disabled:opacity-50"
                  >
                    <RotateCw className={`h-3.5 w-3.5 ${isRescoring ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-sm text-text-secondary">Interview Score</span>
                <Badge variant={interview?.ai_score && interview.ai_score > 75 ? 'shortlisted' : 'screening'}>
                  {interview?.ai_score != null ? `${interview.ai_score}/100` : 'Pending'}
                </Badge>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-sm text-text-secondary">Current Status</span>
                <Badge variant={applicant.status}>{applicant.status}</Badge>
              </div>
            </div>

            <a 
              href={applicant.resume_url} 
              target="_blank" 
              rel="noreferrer"
              className="mt-6 flex items-center justify-center gap-2 w-full text-sm font-medium text-accent-primary bg-accent-muted px-4 py-3 rounded-lg hover:bg-accent-primary hover:text-on-accent transition-colors border border-accent-primary/20"
            >
              <FileText className="h-4 w-4" /> View Original Resume
            </a>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-text-primary flex items-center gap-2 mb-3">
              <Bot className="h-4 w-4 text-accent-primary" /> AI Resume Summary
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {applicant.ats_summary || 'No summary available. ATS scoring may still be in progress.'}
            </p>
          </Card>

          {interview?.ai_feedback && (
            <Card className="p-6">
              <h3 className="font-semibold text-text-primary flex items-center gap-2 mb-3">
                <Bot className="h-4 w-4 text-accent-primary" /> AI Interview Feedback
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {interview.ai_feedback}
              </p>
            </Card>
          )}

          {applicant.status !== 'rejected' && (
            <ScheduleVideoCard applicationId={applicant.id} candidateName={applicant.candidate_name} />
          )}

          {applicant.status !== 'rejected' && applicant.status !== 'shortlisted' && (
            <div className="flex gap-3 pt-2">
              <Button 
                className="flex-1 bg-success hover:bg-success/90 text-[#fff]"
                loading={isUpdating === 'shortlisted'}
                onClick={() => handleStatusUpdate('shortlisted')}
              >
                <Check className="h-4 w-4 mr-2" /> Accept
              </Button>
              <Button 
                className="flex-1" variant="danger"
                loading={isUpdating === 'rejected'}
                onClick={() => handleStatusUpdate('rejected')}
              >
                <X className="h-4 w-4 mr-2" /> Reject
              </Button>
            </div>
          )}

          {(applicant.status === 'shortlisted' || applicant.status === 'rejected') && (
            <div className="text-center py-3">
              <Badge variant={applicant.status} className="text-base px-4 py-2">
                {applicant.status === 'shortlisted' ? 'Shortlisted' : 'Rejected'}
              </Badge>
            </div>
          )}
        </div>

        {/* Right Column - Interview Transcript */}
        <div className="w-full md:w-2/3">
          <Card className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-accent-primary" /> AI Interview Transcript
                </h2>
                <p className="text-sm text-text-secondary mt-1">
                  Full transcript of the technical screening interview.
                </p>
              </div>
              <Badge variant={interview?.status === 'completed' ? 'shortlisted' : interview?.status === 'in_progress' ? 'interviewing' : 'applied'}>
                {interview?.status || 'Not Started'}
              </Badge>
            </div>

            <div className="flex-1 bg-bg-base rounded-lg border border-border-subtle overflow-hidden min-h-[300px]">
              {interview ? (
                <TranscriptView transcript={interview.transcript || []} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center text-text-secondary px-4">
                  <PlayCircle className="h-12 w-12 mb-4 text-text-muted opacity-50" />
                  <p className="font-medium text-text-primary mb-2">Interview Not Started</p>
                  <p className="text-sm max-w-xs">
                    {applicant.status === 'interviewing' 
                      ? 'The candidate has been invited but hasn\'t started the interview yet.'
                      : 'The candidate hasn\'t reached the interview stage yet.'}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
