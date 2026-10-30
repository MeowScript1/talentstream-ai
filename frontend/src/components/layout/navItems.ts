import {
  LayoutDashboard,
  Briefcase,
  Users,
  Settings,
  Search,
  FileText,
  Video,
  UserRound,
  ShieldCheck,
} from 'lucide-react';

export interface NavItem {
  name: string;
  /** Short label for the phone's bottom tab bar */
  short: string;
  href: string;
  icon: typeof Search;
}

const recruiterNav: NavItem[] = [
  { name: 'Dashboard', short: 'Home', href: '/dashboard/recruiter', icon: LayoutDashboard },
  { name: 'Post a Job', short: 'Post', href: '/jobs/new', icon: Briefcase },
  { name: 'Applicants', short: 'People', href: '/applicants', icon: Users },
  { name: 'Settings', short: 'Settings', href: '/settings', icon: Settings },
];

const candidateNav: NavItem[] = [
  { name: 'Find Jobs', short: 'Jobs', href: '/dashboard/candidate', icon: Search },
  { name: 'My Applications', short: 'Applied', href: '/applications', icon: FileText },
  { name: 'Interview Room', short: 'Interview', href: '/interview', icon: Video },
  { name: 'Company check', short: 'Check', href: '/companies', icon: ShieldCheck },
  { name: 'Profile', short: 'Profile', href: '/profile', icon: UserRound },
];

export function navItemsFor(role: 'employer' | 'candidate'): NavItem[] {
  return role === 'employer' ? recruiterNav : candidateNav;
}
