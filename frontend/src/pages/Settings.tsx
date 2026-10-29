import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Lock,
  Bell,
  ShieldAlert,
  Save,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
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

export default function Settings() {
  const { user, updateProfile, changePassword } = useAuthStore();

  // Profile form
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name ?? '',
    company_name: user?.company_name ?? '',
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

  // Notification preferences (local only for now)
  const [notifications, setNotifications] = useState({
    new_applicant: true,
    shortlisted: true,
    interview_completed: true,
    marketing: false,
  });

  const handleProfileSave = async () => {
    if (!profileForm.full_name.trim()) return toast.error('Full name is required');
    setProfileSaving(true);
    try {
      await updateProfile({
        full_name: profileForm.full_name,
        company_name: profileForm.company_name,
      });
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

  const toggleNotification = (key: keyof typeof notifications) =>
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">Settings</h1>
        <p className="text-text-secondary mt-1">Manage your account, company profile and preferences.</p>
      </motion.div>

      <motion.div
        className="space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Company Profile */}
        <motion.div variants={itemVariants}>
          <Card className="p-6">
            <SectionHeader
              icon={Building2}
              title="Company Profile"
              description="Update your company's public information"
            />

            {/* Avatar */}
            <div className="flex items-center gap-4 mb-6">
              <div className="h-16 w-16 rounded-full bg-accent-muted border-2 border-accent-primary/30 flex items-center justify-center flex-shrink-0 text-2xl font-bold text-accent-primary">
                {(user?.full_name ?? 'U').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{user?.full_name}</p>
                <p className="text-xs text-text-muted">{user?.email}</p>
                <button className="-mb-3 mt-1 py-3 text-xs text-accent-primary hover:underline">
                  Upload avatar (coming soon)
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Full Name</label>
                <Input
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Company Name</label>
                <Input
                  value={profileForm.company_name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, company_name: e.target.value }))}
                  placeholder="Your company or organization name"
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
                <Save className="h-4 w-4" /> Save Profile
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

        {/* Notification Preferences */}
        <motion.div variants={itemVariants}>
          <Card className="p-6">
            <SectionHeader
              icon={Bell}
              title="Notification Preferences"
              description="Choose what updates you receive"
            />

            <div className="space-y-4">
              {[
                { key: 'new_applicant' as const, label: 'New Applicant', description: 'When someone applies to your job' },
                { key: 'shortlisted' as const, label: 'Candidate Shortlisted', description: 'When you shortlist a candidate' },
                { key: 'interview_completed' as const, label: 'Interview Completed', description: "When a candidate finishes an AI interview" },
                { key: 'marketing' as const, label: 'Product Updates & Tips', description: 'Occasional emails about new features' },
              ].map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium text-text-primary">{label}</div>
                    <div className="text-xs text-text-muted">{description}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleNotification(key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-md transition-colors before:absolute before:inset-x-0 before:-inset-y-3 before:content-[''] ${
                      notifications[key] ? 'bg-accent-primary' : 'bg-bg-elevated border border-border-subtle'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-[#fff] shadow transition-transform ${
                        notifications[key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div variants={itemVariants}>
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-6">
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
                  Permanently delete your account and all associated data. This cannot be undone.
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
