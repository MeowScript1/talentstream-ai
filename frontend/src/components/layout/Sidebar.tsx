import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Settings,
  Search,
  FileText,
  Video,
  UserRound,
} from 'lucide-react';

export function Sidebar() {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) return null;

  const recruiterNav = [
    { name: 'Dashboard', href: '/dashboard/recruiter', icon: LayoutDashboard },
    { name: 'Post a Job', href: '/jobs/new', icon: Briefcase },
    { name: 'Applicants', href: '/applicants', icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const candidateNav = [
    { name: 'Find Jobs', href: '/dashboard/candidate', icon: Search },
    { name: 'My Applications', href: '/applications', icon: FileText },
    { name: 'Interview Room', href: '/interview', icon: Video },
    { name: 'Profile', href: '/profile', icon: UserRound },
  ];

  const navItems = user.role === 'employer' ? recruiterNav : candidateNav;
  const isActive = (href: string) => location.pathname.startsWith(href);

  return (
    <>
      {/* Desktop: floating glass rail */}
      <aside className="fixed left-4 top-20 z-30 hidden h-[calc(100vh-6.5rem)] w-60 md:block">
        <nav className="glass flex h-full flex-col gap-1.5 rounded-3xl p-3">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors duration-150',
                  active
                    ? 'text-bg-base'
                    : 'text-text-secondary hover:bg-white/[0.06] hover:text-text-primary'
                )}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="absolute inset-0 rounded-2xl bg-accent-primary shadow-glow"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  />
                )}
                <Icon className="relative z-10 h-5 w-5" strokeWidth={active ? 2.75 : 2} />
                <span className="relative z-10">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile: bottom tab bar (the sidebar is hidden below md) */}
      <nav className="glass fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-full p-1.5 md:hidden">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              to={item.href}
              aria-label={item.name}
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full transition-all',
                active ? 'bg-accent-primary text-bg-base shadow-glow' : 'text-text-secondary'
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.75 : 2} />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
