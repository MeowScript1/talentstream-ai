import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { isAxiosError } from 'axios';
import { getApiError } from '@/lib/utils';
import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { AuthShell } from '@/components/layout/AuthShell';
import { Briefcase, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function Register() {
  const [role, setRole] = useState<'employer' | 'candidate'>('candidate');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    company_name: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Frontend validation
    if (formData.full_name.trim().length < 2) {
      toast.error('Full name must be at least 2 characters');
      return;
    }
    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (formData.password !== formData.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    if (role === 'employer' && !formData.company_name.trim()) {
      toast.error('Company name is required for employers');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await api.post('/auth/register', {
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name.trim(),
        role,
        company_name: role === 'employer' ? formData.company_name.trim() : undefined,
      });
      
      login(response.data.access_token, response.data.user);
      toast.success('You\'re in! 🎉');
      
      if (role === 'employer') {
        navigate('/dashboard/recruiter');
      } else {
        navigate('/dashboard/candidate');
      }
    } catch (error) {
      const response = isAxiosError(error) ? error.response : undefined;
      const message = getApiError(error, '');

      if (message) {
        toast.error(message);
      } else if (response?.status === 409) {
        toast.error('This email address is already registered');
      } else if (response?.status === 422) {
        toast.error('Please check your input and try again');
      } else if (!response) {
        toast.error('Unable to connect to server. Please check your connection.');
      } else {
        toast.error('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      headline={
        <>
          Your next gig
          <br />
          starts <span className="text-gradient-hot">here</span> 🚀
        </>
      }
      subline="Candidates get matched and interviewed by AI. Recruiters get a ranked shortlist. Everyone saves time."
    >
      <Card className="w-full p-8 shadow-glow-violet">
          <div className="mb-6">
            <h2 className="text-2xl font-extrabold text-text-primary">Join the club 🎟️</h2>
            <p className="mt-2 text-sm text-text-secondary">Takes under a minute. Free forever for candidates.</p>
          </div>

          <div className="flex gap-4 mb-6">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setRole('candidate')}
              className={`flex-1 cursor-pointer rounded-2xl border p-4 text-center transition-all ${
                role === 'candidate' 
                  ? 'bg-accent-primary/15 border-accent-primary/60 text-accent-primary shadow-glow'
                  : 'bg-white/[0.03] border-white/10 text-text-secondary hover:border-white/25'
              }`}
            >
              <User className="mx-auto mb-2 h-6 w-6" />
              <div className="text-sm font-bold">I'm job hunting 🔍</div>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setRole('employer')}
              className={`flex-1 cursor-pointer rounded-2xl border p-4 text-center transition-all ${
                role === 'employer' 
                  ? 'bg-accent-primary/15 border-accent-primary/60 text-accent-primary shadow-glow'
                  : 'bg-white/[0.03] border-white/10 text-text-secondary hover:border-white/25'
              }`}
            >
              <Briefcase className="mx-auto mb-2 h-6 w-6" />
              <div className="text-sm font-bold">I'm hiring 🧑‍💼</div>
            </motion.div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-text-secondary mb-1.5">Full Name</label>
              <Input
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                placeholder="Your name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-text-secondary mb-1.5">Email address</label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="you@email.com"
                required
              />
            </div>
            
            <AnimatePresence>
              {role === 'employer' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <label className="block text-sm font-bold text-text-secondary mb-1.5 mt-4">Company Name</label>
                  <Input
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleInputChange}
                    placeholder="Acme Inc."
                    required={role === 'employer'}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-1.5">Password</label>
                <Input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-1.5">Confirm Password</label>
                <Input
                  type="password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full mt-6" loading={isLoading}>
              Create my account →
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-text-secondary">
            Already in?{' '}
            <Link to="/login" className="inline-block py-3 -my-3 font-bold text-accent-primary hover:underline underline-offset-4">
              Log in
            </Link>
          </div>
      </Card>
    </AuthShell>
  );
}
