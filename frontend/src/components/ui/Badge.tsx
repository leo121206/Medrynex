import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface BadgeProps {
  variant?: 'sage' | 'dark' | 'beige' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'sage',
  children,
  className,
  icon,
}) => {
  const variants = {
    sage: 'bg-[#E7F0E4] text-[#47634C] border border-[#A8CBA0]/50',
    dark: 'bg-[#47634C] text-white',
    beige: 'bg-[#F2E7D5] text-[#47634C] border border-[#DDE5DA]',
    success: 'bg-[#eaf3eb] text-[#5F8D65] border border-[#5F8D65]/30',
    warning: 'bg-[#fcf5e5] text-[#D9A441] border border-[#D9A441]/30',
    danger: 'bg-[#fceded] text-[#C85C5C] border border-[#C85C5C]/30',
    info: 'bg-[#eaf2f6] text-[#668FA3] border border-[#668FA3]/30',
    neutral: 'bg-gray-100 text-gray-700 border border-gray-200',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full',
          variants[variant],
          className
        )
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
