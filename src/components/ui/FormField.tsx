import React from 'react';
import { cn } from '../../lib/utils';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  error,
  helperText,
  required,
  children,
  className,
}) => {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-semibold text-ink-primary flex items-center justify-between">
        <span>
          {label} {required && <span className="text-severity-critical-text font-bold">*</span>}
        </span>
      </label>
      {children}
      {error && <span className="text-[11px] text-severity-critical-text font-medium">{error}</span>}
      {!error && helperText && <span className="text-[11px] text-ink-muted">{helperText}</span>}
    </div>
  );
};
