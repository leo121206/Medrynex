import React from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Lock, Clock, Ban } from 'lucide-react';
import { Badge } from './Badge';

interface StatusBadgeProps {
  status: 'active' | 'approved' | 'pending' | 'expired' | 'revoked' | 'rejected' | 'emergency' | 'disputed' | 'verified';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  switch (status) {
    case 'active':
    case 'approved':
    case 'verified':
      return (
        <Badge variant="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />} className={className}>
          ● {status === 'verified' ? 'Verified' : status === 'approved' ? 'Approved' : 'Active'}
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="warning" icon={<Clock className="w-3.5 h-3.5" />} className={className}>
          ⏱ Pending
        </Badge>
      );
    case 'expired':
      return (
        <Badge variant="neutral" icon={<Lock className="w-3.5 h-3.5" />} className={className}>
          🔒 Expired
        </Badge>
      );
    case 'revoked':
      return (
        <Badge variant="neutral" icon={<Ban className="w-3.5 h-3.5" />} className={className}>
          🚫 Revoked
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="danger" icon={<Ban className="w-3.5 h-3.5" />} className={className}>
          ✖ Rejected
        </Badge>
      );
    case 'emergency':
      return (
        <Badge variant="danger" icon={<ShieldAlert className="w-3.5 h-3.5" />} className={className}>
          🚨 Emergency
        </Badge>
      );
    case 'disputed':
      return (
        <Badge variant="warning" icon={<AlertTriangle className="w-3.5 h-3.5" />} className={className}>
          ⚠ Disputed
        </Badge>
      );
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
};
