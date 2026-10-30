import * as React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'applied' | 'screening' | 'interviewing' | 'shortlisted' | 'rejected';
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'applied', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wider';
    
    const variants = {
      applied: 'bg-white/10 text-text-primary border border-white/10',
      screening: 'bg-warning/20 text-warning border border-warning/30',
      interviewing: 'bg-cyan/15 text-cyan border border-cyan/40',
      shortlisted: 'bg-accent-primary/15 text-accent-primary border border-accent-primary/40',
      rejected: 'bg-danger/20 text-danger border border-danger/30',
    };

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variants[variant], className)}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';

export { Badge };
