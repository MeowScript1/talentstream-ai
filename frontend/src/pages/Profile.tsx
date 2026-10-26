import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User,
  Lock,
  ShieldAlert,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
  BriefcaseBusiness,
  Clock,
  Star,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useApplicationStore } from '@/store/applicationStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { ResumeCard } from '@/components/candidate/ResumeCard';
import toast from 'react-hot-toast';
import { getApiError } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 28 } },
};

function SectionHeader({
  icon: Icon,
  title,
  description,
  iconColor = 'text-accent-primary',
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-border-subtle mb-5">
      <div className="h-9 w-9 rounded-lg bg-accent-muted flex items-center justify-center">
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div>
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, updateProfile, changePassword } = useAuthStore();
  const location = useLocation();

  // Deep link from the dashboard prompt: /profile#resume
  useEffect(() => {
    if (location.hash === '#resume') {
      document.getElementById('resume')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);
  const { myApplications, fetchMyApplications } = useApplicationStore();

  // The stats below come from the applications list, which was only loaded by other pages
  useEffect(() => {
    fetchMyApplications().catch(() => {});
  }, [fetchMyApplications]);

  // Profile form
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name ?? '',
  });
  const [profileSaving, setProfileSaving] = useState(false);

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);

  const stats = useMemo(() => ({
    total: myApplications.length,
    interviewing: myApplications.filter((a) => a.status === 'interviewing').length,
    shortlisted: myApplications.filter((a) => a.status === 'shortlisted').length,
  }), [myApplications]);

  const handleProfileSave = async () => {
    if (!profileForm.full_name.trim()) return toast.error('Full name is required');
    setProfileSaving(true);
    try {
      await updateProfile({ full_name: profileForm.full_name });
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    if (!passwordForm.current_password) return toast.error('Enter your current password');
    if (passwordForm.new_password.length < 8)
      return toast.error('New password must be at least 8 characters');
    if (passwordForm.new_password !== passwordForm.confirm_password)
      return toast.error('Passwords do not match');

    setPasswordSaving(true);
    try {
      await changePassword(passwordForm.current_password, passwordForm.new_password);
      toast.success('Password changed successfully');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(getApiError(err, 'Failed to change password'));
    } finally {
      setPasswordSaving(false);
    }
  };

  // Generate a colour from the user's name for the avatar
  const avatarColor = useMemo(() => {
    const colors = [
      'from-violet-500 to-indigo-500',
      'from-teal-400 to-cyan-500',
      'from-rose-400 to-pink-500',
      'from-amber-400 to-orange-500',
      'from-emerald-400 to-green-500',
    ];
    const idx = (user?.full_name?.charCodeAt(0) ?? 0) % colors.length;
    return colors[idx];
  }, [user]);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary">My Profile</h1>
        <p className="text-text-secondary mt-1">Manage your personal information and account security.</p>
      </motion.div>

      <motion.div className="space-y-6" variants={containerVariants} initial="hidden" animate="show">

        {/* Profile Card with Avatar & Stats */}
        <motion.div variants={itemVariants}>
          <Card className="p-6">
            <div className="flex items-center gap-5 mb-6">
              {/* Avatar */}
              <div className={`h-20 w-20 rounded-2xl bg-gradient-to-br ${avatarColor} flex items-center justify-center flex-shrink-0 text-3xl font-bold text-white shadow-glow`}>
                {(user?.full_name ?? 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary">{user?.full_name}</h2>
                <p className="text-sm text-text-secondary">{user?.email}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent-primary bg-accent-muted px-2.5 py-1 rounded-full border border-accent-primary/20">
                  <User className="h-3 w-3" />
                  Candidate
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border-subtle">
              {[
                { label: 'Applications', value: stats.total, icon: BriefcaseBusiness, color: 'text-text-primary' },
                { label: 'Interviewing', value: stats.interviewing, icon: Clock, color: 'text-accent-primary' },
                { label: 'Shortlisted', value: stats.shortlisted, icon: Star, color: 'text-success' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="text-center">
                  <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
                  <div className={`text-xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-text-muted">{label}</div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Resume */}
        <motion.div variants={itemVariants}>
          <ResumeCard />
        </motion.div>

        {/* Personal Info */}
        <motion.div variants={itemVariants}>
          <Card className="p-6">
            <SectionHeader
              icon={User}
              title="Personal Information"
              description="Update your name and public display information"
            />

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Full Name</label>
                <Input
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ full_name: e.target.value })}
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Email Address</label>
                <Input
                  value={user?.email ?? ''}
                  disabled
                  className="opacity-50 cursor-not-allowed"
                />
                <p className="text-xs text-text-muted mt-1">Email cannot be changed.</p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={handleProfileSave} loading={profileSaving} className="gap-2">
                <Save className="h-4 w-4" /> Save Changes
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Change Password */}
        <motion.div variants={itemVariants}>
          <Card className="p-6">
            <SectionHeader
              icon={Lock}
              title="Change Password"
              description="Use a strong, unique password to keep your account secure"
            />

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Current Password</label>
                <div className="relative">
                  <Input
                    type={showPasswords ? 'text' : 'password'}
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, current_password: e.target.value }))}
                    placeholder="Enter current password"
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords((v) => !v)}
                    aria-label="Show or hide password" className="absolute right-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">New Password</label>
                <Input
                  type={showPasswords ? 'text' : 'password'}
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm((f) => ({ ...f, new_password: e.target.value }))}
                  placeholder="At least 8 characters"
                />
                {passwordForm.new_password && (
                  <div className="flex gap-1 mt-2">
                    {[8, 12, 16].map((n) => (
                      <div
                        key={n}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          passwordForm.new_password.length >= n
                            ? n === 8 ? 'bg-danger' : n === 12 ? 'bg-warning' : 'bg-success'
                            : 'bg-bg-elevated'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Confirm New Password</label>
                <div className="relative">
                  <Input
                    type={showPasswords ? 'text' : 'password'}
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm((f) => ({ ...f, confirm_password: e.target.value }))}
                    placeholder="Repeat new password"
                    className="pr-11"
                  />
                  {passwordForm.confirm_password && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {passwordForm.confirm_password === passwordForm.new_password ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-danger/20 border border-danger flex items-center justify-center">
                          <div className="h-1.5 w-1.5 rounded-full bg-danger" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={handlePasswordSave} loading={passwordSaving} className="gap-2">
                <Lock className="h-4 w-4" /> Change Password
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div variants={itemVariants}>
          <div className="rounded-2xl border border-danger/30 bg-danger/5 p-6">
            <SectionHeader
              icon={ShieldAlert}
              title="Danger Zone"
              description="Irreversible and destructive actions"
              iconColor="text-danger"
            />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">Delete Account</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Permanently deletes your profile and all applications. Cannot be undone.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => toast.error('Please contact support to delete your account.')}
              >
                Delete Account
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
