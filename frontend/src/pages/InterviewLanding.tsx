import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  Mic,
  Wifi,
  Bot,
  Building2,
  Play,
  Clock,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react';
import { useApplicationStore } from '@/store/applicationStore';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

const TIPS = [
  { icon: Mic, text: 'Speak clearly — AI analyses both content and communication style.' },
  { icon: Lightbulb, text: 'Think out loud. Walking through your reasoning shows problem-solving skill.' },
  { icon: Clock, text: 'Take your time. Pausing to formulate a good answer is always better than rushing.' },
  { icon: CheckCircle2, text: 'Be specific. Use real examples from your past experience whenever possible.' },
];

function DeviceCheckRow({ icon: Icon, label, status }: { icon: React.ElementType; label: string; status: 'ok' | 'warn' }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border-subtle last:border-0">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${status === 'ok' ? 'bg-success/10' : 'bg-warning/10'}`}>
        <Icon className={`h-4 w-4 ${status === 'ok' ? 'text-success' : 'text-warning'}`} />
      </div>
      <span className="text-sm text-text-secondary flex-1">{label}</span>
      <div className={`h-2 w-2 rounded-full ${status === 'ok' ? 'bg-success' : 'bg-warning animate-pulse'}`} />
    </div>
  );
}

export default function InterviewLanding() {
  const navigate = useNavigate();
  const { myApplications, isLoading, fetchMyApplications } = useApplicationStore();

  useEffect(() => {
    fetchMyApplications();
  }, []);

  const pendingInterviews = useMemo(
    () => myApplications.filter((a) => a.status === 'interviewing'),
    [myApplications]
  );

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary">Interview Room</h1>
        <p className="text-text-secondary mt-1">
          Enter your scheduled AI interviews below. Take a moment to prepare before you start.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column — Pending Interviews */}
        <div className="lg:col-span-2 space-y-5">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Video className="h-5 w-5 text-accent-primary" />
            Scheduled Interviews
            {!isLoading && (
              <span className="ml-auto text-sm font-normal text-text-muted">
                {pendingInterviews.length} pending
              </span>
            )}
          </h2>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}
            </div>
          ) : pendingInterviews.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 border border-dashed border-border-subtle rounded-2xl bg-bg-surface text-center"
            >
              <div className="h-16 w-16 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center mb-4">
                <Video className="h-8 w-8 text-text-muted opacity-50" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">No interviews scheduled</h3>
              <p className="text-sm text-text-secondary max-w-xs mb-6">
                Once a recruiter invites you to interview, it will appear here. Keep applying!
              </p>
              <Button variant="ghost" onClick={() => navigate('/dashboard/candidate')}>
                Browse Open Jobs
              </Button>
            </motion.div>
          ) : (
            <AnimatePresence>
              {pendingInterviews.map((app, i) => (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="bg-bg-surface border border-accent-primary/30 rounded-2xl p-6 shadow-glow relative overflow-hidden"
                >
                  {/* Glow accent */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent-primary to-transparent" />

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-accent-muted border border-accent-primary/30 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-6 w-6 text-accent-primary" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-text-primary">{app.job_title}</h3>
                        <div className="flex items-center gap-1.5 text-sm text-text-secondary mt-0.5">
                          <Building2 className="h-3.5 w-3.5" />
                          {app.employer_name || 'Company'}
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-accent-primary bg-accent-muted px-2.5 py-1 rounded-full border border-accent-primary/20">
                            <div className="h-1.5 w-1.5 rounded-full bg-accent-primary animate-pulse" />
                            Interview Ready
                          </div>
                          {app.ats_score != null && (
                            <div className="text-xs text-text-muted bg-bg-elevated px-2.5 py-1 rounded-full border border-border-subtle">
                              ATS Score: <span className="font-semibold text-text-primary">{app.ats_score}/100</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => navigate(`/interview/${app.id}`)}
                      className="flex-shrink-0 gap-2 ring-2 ring-accent-primary/30 ring-offset-1 ring-offset-bg-base"
                    >
                      <Play className="h-4 w-4" />
                      Start Interview
                    </Button>
                  </div>

                  {/* Animated progress bar */}
                  <div className="mt-5 h-1 rounded-full bg-bg-elevated overflow-hidden">
                    <motion.div
                      className="h-full bg-accent-primary/50 rounded-full"
                      initial={{ width: '20%' }}
                      animate={{ width: ['20%', '60%', '20%'] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                  <p className="text-xs text-text-muted mt-2">AI interviewer is ready and waiting for you</p>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Right Column — Tips & Device Check */}
        <div className="space-y-5">
          {/* Device Check */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-bg-surface border border-border-subtle rounded-2xl p-5 shadow-card"
          >
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Wifi className="h-4 w-4 text-accent-primary" />
              System Check
            </h3>
            <div>
              <DeviceCheckRow icon={Wifi} label="Internet Connection" status="ok" />
              <DeviceCheckRow icon={Mic} label="Microphone (optional)" status="warn" />
              <DeviceCheckRow icon={Video} label="Camera (optional)" status="warn" />
            </div>
            <p className="text-xs text-text-muted mt-3">
              Camera and mic are optional. You can complete the interview by typing.
            </p>
          </motion.div>

          {/* Tips */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-bg-surface border border-border-subtle rounded-2xl p-5 shadow-card"
          >
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-accent-primary" />
              Interview Tips
            </h3>
            <div className="space-y-3">
              {TIPS.map(({ icon: Icon, text }, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.07 }}
                  className="flex items-start gap-3"
                >
                  <div className="h-7 w-7 rounded-lg bg-accent-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-accent-primary" />
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">{text}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
