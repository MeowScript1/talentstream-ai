import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  error?: boolean;
}

export const TagInput = React.forwardRef<HTMLInputElement, TagInputProps>(
  ({ className, value, onChange, placeholder = 'Add item...', error, ...props }, ref) => {
    const [inputValue, setInputValue] = React.useState('');

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const newTag = inputValue.trim();
        if (newTag && !value.includes(newTag)) {
          onChange([...value, newTag]);
          setInputValue('');
        }
      } else if (e.key === 'Backspace' && !inputValue && value.length > 0) {
        onChange(value.slice(0, -1));
      }
    };

    const removeTag = (tagToRemove: string) => {
      onChange(value.filter((tag) => tag !== tagToRemove));
    };

    return (
      <div
        className={cn(
          'flex min-h-12 w-full flex-wrap items-center gap-2 rounded-2xl border border-border-subtle bg-bg-base px-3 py-1.5 focus-within:ring-2 focus-within:ring-border-active',
          error && 'border-danger focus-within:ring-danger',
          className
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-md bg-bg-elevated px-2 py-1 text-sm text-text-primary border border-border-subtle"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-text-muted hover:text-danger focus:outline-none"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={ref}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 bg-transparent px-1 py-1 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          {...props}
        />
      </div>
    );
  }
);

TagInput.displayName = 'TagInput';
