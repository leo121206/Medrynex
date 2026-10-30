/**
 * ApiStateWrapper — Renders loading skeletons, error banners, or empty states
 * so every page gets consistent UX without duplicating logic.
 */
import React from 'react';
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';
import { Button } from './Button';

interface Props {
  loading: boolean;
  error: string | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  skeletonRows?: number;
  children: React.ReactNode;
}

/** A single animated skeleton line */
const SkeletonLine: React.FC<{ width?: string }> = ({ width = '100%' }) => (
  <div
    className="h-4 bg-[#DDE5DA]/60 rounded animate-pulse"
    style={{ width }}
  />
);

/** A card-shaped skeleton placeholder */
const SkeletonCard: React.FC = () => (
  <div className="bg-white border border-[#DDE5DA] rounded-2xl p-4 space-y-3">
    <SkeletonLine width="60%" />
    <SkeletonLine width="80%" />
    <SkeletonLine width="40%" />
  </div>
);

export const ApiStateWrapper: React.FC<Props> = ({
  loading,
  error,
  isEmpty = false,
  emptyTitle = 'No data yet',
  emptyMessage = 'No records found for your account.',
  onRetry,
  skeletonRows = 3,
  children,
}) => {
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-[#C85C5C]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-[#26352A]">Could not load data</p>
          <p className="text-xs text-[#66736A] mt-1 max-w-xs">{error}</p>
        </div>
        {onRetry && (
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={onRetry}
          >
            Try Again
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-[#E7F0E4] flex items-center justify-center">
          <Inbox className="w-6 h-6 text-[#47634C]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-[#26352A]">{emptyTitle}</p>
          <p className="text-xs text-[#66736A] mt-1 max-w-xs">{emptyMessage}</p>
        </div>
        {onRetry && (
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={onRetry}
          >
            Refresh
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
};
