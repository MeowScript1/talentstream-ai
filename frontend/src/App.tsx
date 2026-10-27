import { useEffect } from 'react';
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
import { Spinner } from '@/components/ui/Spinner';

/** The front door: sign in first, then you land on your dashboard (where candidates see the jobs). */
function Home() {
  const { user, token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  return <Navigate to={user.role === 'employer' ? '/dashboard/recruiter' : '/dashboard/candidate'} replace />;
}

function App() {
  const location = useLocation();
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
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
          <Route path="/profile" element={<Profile />} />

        </Route>
      </Routes>
    </motion.div>
  );
}

export default App;

