import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all hover:border-white/20 focus-visible:outline-none focus-visible:border-accent-primary/70 focus-visible:bg-white/[0.06] focus-visible:ring-4 focus-visible:ring-accent-primary/15 disabled:cursor-not-allowed disabled:opacity-50',
          error && 'border-danger focus-visible:border-danger focus-visible:ring-danger/20',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
