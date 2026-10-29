import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import toast from 'react-hot-toast';
import { getApiError } from '@/lib/utils';
import { AuthShell } from '@/components/layout/AuthShell';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      login(response.data.access_token, response.data.user);
      toast.success('Logged in');
      
      if (response.data.user.role === 'employer') {
        navigate('/dashboard/recruiter');
      } else {
        navigate('/dashboard/candidate');
      }
    } catch (error) {
      toast.error(getApiError(error, 'Invalid credentials'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      headline={
        <>
          Real jobs and walk‑in drives, in one place
        </>
      }
      subline="Listings from several job sites, each with a scam check. Upload your resume once to see how well it fits a role, and take the first interview online."
    >
      <Card className="w-full p-8 ">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-text-primary">Log in</h2>
          <p className="mt-2 text-sm text-text-secondary">Use the email and password you registered with.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-text-secondary">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-text-secondary">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" size="lg" className="mt-6 w-full" loading={isLoading}>
            Log in
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-text-secondary">
          No account yet?{' '}
          <Link to="/register" className="inline-block py-3 -my-3 font-bold text-accent-primary hover:underline underline-offset-4">
            Create an account
          </Link>
        </div>
      </Card>
    </AuthShell>
  );
}
