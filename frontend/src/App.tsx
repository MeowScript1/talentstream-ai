import { useEffect, useState } from 'react';
import { Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { motion } from 'framer-motion';
import { PageLayout } from '@/components/layout/PageLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import RecruiterDashboard from '@/pages/RecruiterDashboard';
import CandidateDashboard from '@/pages/CandidateDashboard';
import ApplicantDetail from '@/pages/ApplicantDetail';
import InterviewRoom from '@/pages/InterviewRoom';

// Employer pages
import PostJob from '@/pages/PostJob';
import Applicants from '@/pages/Applicants';
import Settings from '@/pages/Settings';

// Candidate pages
import MyApplications from '@/pages/MyApplications';
import InterviewLanding from '@/pages/InterviewLanding';
import Profile from '@/pages/Profile';
import CompanyCheck from '@/pages/CompanyCheck';
import InterviewPractice from '@/pages/InterviewPractice';
import { Spinner } from '@/components/ui/Spinner';

/** Shown while the server wakes up after being idle; says so instead of spinning silently. */
function WakingUp() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Spinner size="lg" />
      {slow && (
        <p className="text-sm text-text-secondary">
          Waking up the server after a quiet spell. This can take up to a minute the first time.
        </p>
      )}
    </div>
  );
}

/** The front door: sign in first, then you land on your dashboard (where candidates see the jobs). */
function Home() {
  const { user, token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (!user) return <WakingUp />;
  return <Navigate to={user.role === 'employer' ? '/dashboard/recruiter' : '/dashboard/candidate'} replace />;
}

function App() {
  const location = useLocation();
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    // Start waking the server right away so it is ready by the time someone logs in
    try {
      const base = import.meta.env.VITE_API_URL;
      if (base) fetch(new URL('/health', base).href, { mode: 'no-cors' }).catch(() => undefined);
    } catch {
      // warming up is only an optimisation
    }
  }, [hydrate]);

  return (
    // Pages fade in on every route change. There is deliberately no exit animation / AnimatePresence:
    // it kept the previous page mounted while fading out, and a protected page that was redirecting
    // (e.g. an expired session) then re-fired its redirect in a loop and the login page never rendered.
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/jobs" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route element={<ProtectedRoute><PageLayout /></ProtectedRoute>}>
          {/* Shared */}
          <Route path="/dashboard/recruiter" element={<RecruiterDashboard />} />
          <Route path="/dashboard/candidate" element={<CandidateDashboard />} />
          <Route path="/applicant/:id" element={<ApplicantDetail />} />
          <Route path="/interview/:id" element={<InterviewRoom />} />

          {/* Employer */}
          <Route path="/jobs/new" element={<PostJob />} />
          <Route path="/applicants" element={<Applicants />} />
          <Route path="/settings" element={<Settings />} />

          {/* Candidate */}
          <Route path="/applications" element={<MyApplications />} />
          <Route path="/interview" element={<InterviewLanding />} />
          <Route path="/interview/practice" element={<InterviewPractice />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/companies" element={<CompanyCheck />} />

        </Route>
      </Routes>
    </motion.div>
  );
}

export default App;

