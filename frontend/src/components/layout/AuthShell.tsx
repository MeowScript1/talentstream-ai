import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

interface AuthShellProps {
  headline: ReactNode;
  subline: string;
  children: ReactNode;
}

/** Floating "proof" stickers on the hero side. Purely decorative. */
const stickers = [
  { text: '92% match 🔥', className: 'left-[6%] top-[14%] bg-accent-primary text-bg-base', rotate: '-6deg', anim: 'animate-float' },
  { text: 'Interview in 2 min ⚡', className: 'right-[8%] top-[9%] bg-violet text-white', rotate: '5deg', anim: 'animate-float-slow' },
  { text: "You're shortlisted 🎉", className: 'left-[10%] bottom-[24%] bg-pink text-white', rotate: '4deg', anim: 'animate-float-slow' },
  { text: 'zero ghosting 👻', className: 'right-[12%] bottom-[12%] bg-cyan text-bg-base', rotate: '-4deg', anim: 'animate-float' },
];

export function AuthShell({ headline, subline, children }: AuthShellProps) {
  return (
    <div className="flex min-h-dvh w-full">
      {/* Hero — desktop only */}
      <div className="relative hidden w-1/2 overflow-hidden border-r border-white/[0.07] lg:flex lg:flex-col lg:justify-center lg:px-16">
        <Link to="/" className="absolute left-10 top-8 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent-primary text-bg-base shadow-pop">
            <Sparkles className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="font-display text-xl font-extrabold tracking-tight">
            Talent<span className="text-gradient">Stream</span>
          </span>
        </Link>

        {stickers.map((s) => (
          <span
            key={s.text}
            style={{ ['--r' as string]: s.rotate, transform: `rotate(${s.rotate})` }}
            className={`absolute ${s.className} ${s.anim} rounded-full px-4 py-2 text-sm font-extrabold shadow-[0_10px_30px_-8px_rgba(0,0,0,0.6)]`}
          >
            {s.text}
          </span>
        ))}

        <div className="relative z-10 max-w-lg">
          <h1 className="font-display text-6xl font-extrabold leading-[1.02] tracking-tight xl:text-7xl">
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
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-primary text-bg-base shadow-pop">
              <Sparkles className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="font-display text-2xl font-extrabold tracking-tight">
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
