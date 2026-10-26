import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'link' | 'outline' | 'secondary';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', loading, children, disabled, ...props },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-full font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base disabled:pointer-events-none disabled:opacity-50';
    
    const variants = {
      primary: 'bg-accent-primary text-bg-base shadow-pop hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-[0_6px_0_0_var(--accent-shadow)] active:translate-y-1 active:shadow-none',
      ghost: 'bg-white/[0.03] text-text-primary hover:bg-white/[0.08] border border-white/10 hover:border-accent-primary/40',
      danger: 'bg-danger text-bg-base hover:brightness-110 active:scale-95',
      link: 'bg-transparent text-accent-primary hover:underline underline-offset-4',
      outline: 'bg-transparent border border-white/15 text-text-secondary hover:bg-white/[0.06] hover:text-text-primary',
      secondary: 'bg-bg-elevated text-text-primary border border-white/10 hover:border-violet/60 hover:shadow-glow-violet',
    };

    const sizes = {
      sm: 'h-9 px-4 text-xs',
      md: 'h-11 px-6 py-2.5 text-sm',
      lg: 'h-14 px-9 text-base',
      icon: 'h-9 w-9 p-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button };
