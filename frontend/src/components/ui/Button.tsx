import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  isLoading = false,
  className,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-semibold transition-all duration-150 rounded-[12px] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#A8CBA0] text-[#26352A] hover:bg-[#97ba8f] active:scale-[0.99] shadow-sm',
    secondary: 'bg-[#F2E7D5] text-[#47634C] hover:bg-[#e6d8c3] border border-[#DDE5DA] active:scale-[0.99]',
    danger: 'bg-[#fceded] text-[#C85C5C] hover:bg-[#C85C5C] hover:text-white border border-[#f8c4c4]',
    ghost: 'text-[#47634C] hover:bg-[#F2E7D5]/60 hover:text-[#26352A]',
    outline: 'border border-[#47634C] text-[#47634C] hover:bg-[#47634C] hover:text-white',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2.5 gap-2',
    lg: 'text-base px-6 py-3 gap-2.5',
  };

  return (
    <button
      className={twMerge(clsx(baseStyles, variants[variant], sizes[size], className))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon && <span className="inline-flex shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};
