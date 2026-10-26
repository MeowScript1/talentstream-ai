import { Link, useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';

export function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="fixed top-0 z-40 w-full h-16 border-b border-white/[0.07] bg-bg-base/60 backdrop-blur-xl">
      <div className="flex h-full items-center justify-between px-4 sm:px-6">
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent-primary text-bg-base shadow-pop transition-transform group-hover:-rotate-6">
            <Sparkles className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight text-text-primary">
            Talent<span className="text-gradient">Stream</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block leading-tight">
                  <div className="text-sm font-bold text-text-primary">{user.full_name}</div>
                  <div className="text-xs text-text-secondary capitalize">{user.role}</div>
                </div>
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="avatar"
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-accent-primary/60 ring-offset-2 ring-offset-bg-base"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet to-pink text-sm font-extrabold text-white ring-2 ring-white/20 ring-offset-2 ring-offset-bg-base">
                    {user.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Log out
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Join free</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
