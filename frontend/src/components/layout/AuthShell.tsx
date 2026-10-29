import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthShellProps {
  headline: ReactNode;
  subline: string;
  children: ReactNode;
}

export function AuthShell({ headline, subline, children }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh w-full">
      {/* Hero, desktop only */}
      <div className="relative hidden w-1/2 overflow-hidden border-r border-white/[0.07] lg:flex lg:flex-col lg:justify-center lg:px-16">
        <Link to="/" className="absolute left-10 top-8 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-primary font-display text-lg font-bold text-bg-base">
            T
          </span>
          <span className="font-display text-xl font-semibold tracking-tight">
            Talent<span className="text-gradient">Stream</span>
          </span>
        </Link>

        <div className="relative z-10 max-w-lg">
          <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight xl:text-6xl">
            {headline}
          </h1>
          <p className="mt-6 max-w-md text-lg text-text-secondary">{subline}</p>
        </div>
      </div>

      {/* Form side */}
      <div className="flex w-full flex-col items-center justify-center px-5 py-10 lg:w-1/2">
        {/* Brand + one-liner for phones, where the hero is hidden */}
        <div className="mb-8 text-center lg:hidden">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-primary font-display text-lg font-bold text-bg-base">
              T
            </span>
            <span className="font-display text-2xl font-semibold tracking-tight">
              Talent<span className="text-gradient">Stream</span>
            </span>
          </Link>
          <p className="mt-3 text-sm text-text-secondary">{subline}</p>
        </div>

        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
