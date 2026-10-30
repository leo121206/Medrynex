import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, className, id, style, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-[#47634C]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3.5 z-10 text-[#66736A] pointer-events-none flex items-center justify-center">
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            style={{
              paddingLeft: leftIcon ? '2.5rem' : undefined,
              ...style,
            }}
            className={twMerge(
              clsx(
                'medrynx-input',
                leftIcon && '!pl-10',
                error && 'border-[#C85C5C] focus:ring-[#C85C5C]/30',
                className
              )
            )}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs text-[#C85C5C] font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#66736A]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
