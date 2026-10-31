import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { navItemsFor } from './navItems';

export function Sidebar() {
  const { user } = useAuthStore();
  const location = useLocation();

  if (!user) return null;

  const navItems = navItemsFor(user.role);
  const isActive = (href: string) => location.pathname.startsWith(href);
  // Inside a live interview the chat needs the whole screen, so the tab bar steps aside
  const inInterviewRoom = /^\/(interview\/(?!practice$)|meeting\/)[^/]+/.test(location.pathname);

  return (
    <>
      {/* Desktop: floating glass rail */}
      <aside className="fixed left-4 top-[4.5rem] z-30 hidden h-[calc(100vh-6rem)] w-60 md:block">
        <nav className="glass flex h-full flex-col gap-1.5 rounded-xl p-3">
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'relative flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold transition-colors duration-150',
                  active
                    ? 'text-on-secondary-container'
                    : 'text-text-secondary hover:bg-white/[0.06] hover:text-text-primary'
                )}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="absolute inset-0 rounded-lg bg-secondary-container"
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

      {/* Mobile: labelled bottom tab bar (the sidebar is hidden below md) */}
      {!inInterviewRoom && (
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border-subtle bg-bg-surface px-2 pt-1.5 md:hidden"
          style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
        >
          {navItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                to={item.href}
                aria-label={item.name}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 transition-all',
                  active ? 'bg-secondary-container text-on-secondary-container' : 'text-text-secondary active:bg-white/10'
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.75 : 2} />
                <span className="max-w-full truncate text-xs font-bold leading-none">{item.short}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
