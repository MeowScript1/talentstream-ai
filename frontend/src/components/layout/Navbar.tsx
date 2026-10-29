import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { navItemsFor } from './navItems';

export function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // A tap on a link, the browser back button or Escape all close the phone menu
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  const home = user ? (user.role === 'employer' ? '/dashboard/recruiter' : '/dashboard/candidate') : '/';
  const items = user ? navItemsFor(user.role) : [];

  return (
    <nav className="fixed top-0 z-40 w-full border-b border-white/25 bg-bg-base">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Link to={home} className="flex min-h-11 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-primary font-display text-lg font-bold text-on-accent">
            T
          </span>
          <span className="font-display text-xl font-semibold tracking-tight text-text-primary">
            Talent<span className="text-gradient">Stream</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden items-center gap-3 md:flex">
                <div className="text-right leading-tight">
                  <div className="text-sm font-bold text-text-primary">{user.full_name}</div>
                  <div className="text-xs capitalize text-text-secondary">{user.role}</div>
                </div>
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-elevated text-sm font-semibold text-text-primary">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Log out
                </Button>
              </div>

              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/25 text-text-primary md:hidden"
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Create account</Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {user && menuOpen && (
        <div id="mobile-menu" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/25 bg-bg-base px-4 pb-4 pt-3 md:hidden">
          <div className="mb-2 px-1">
            <div className="text-sm font-bold text-text-primary">{user.full_name}</div>
            <div className="text-xs capitalize text-text-secondary">{user.role}</div>
          </div>
          <ul className="divide-y divide-white/15 border-y border-white/15">
            {items.map((item) => {
              const Icon = item.icon;
              const active = location.pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-12 items-center gap-3 px-1 text-sm font-semibold',
                      active ? 'text-text-primary' : 'text-text-secondary'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                    {active && <span className="ml-auto text-xs font-medium text-text-muted">Current page</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Button variant="ghost" className="mt-4 w-full" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      )}
    </nav>
  );
}
