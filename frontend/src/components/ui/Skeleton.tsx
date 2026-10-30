import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, width, height }) => {
  return (
    <div
      className={twMerge(
        clsx(
          'animate-pulse bg-[#DDE5DA]/60 rounded-xl',
          className
        )
      )}
      style={{ width, height }}
    />
  );
};
