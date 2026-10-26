import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { AnimatePresence, motion } from 'framer-motion';
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

function App() {
  const location = useLocation();
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <Routes location={location}>
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

            <Route path="/" element={<Navigate to="/login" replace />} />
          </Route>
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default App;

