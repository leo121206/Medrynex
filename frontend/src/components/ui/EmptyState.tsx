import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 medrynx-card border-dashed">
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-[#F2E7D5] flex items-center justify-center text-[#47634C] mb-4">
          {icon}
        </div>
      )}
      <h4 className="text-lg font-semibold text-[#26352A]">{title}</h4>
      <p className="text-sm text-[#66736A] max-w-md mt-1.5 mb-6">{description}</p>
      
      <div className="flex items-center gap-3">
        {actionText && onAction && (
          <Button variant="primary" onClick={onAction}>
            {actionText}
          </Button>
        )}
        {secondaryActionText && onSecondaryAction && (
          <Button variant="secondary" onClick={onSecondaryAction}>
            {secondaryActionText}
          </Button>
        )}
      </div>
    </div>
  );
};
