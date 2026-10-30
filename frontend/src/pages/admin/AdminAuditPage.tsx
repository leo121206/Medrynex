import React from 'react';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { auditService } from '../../services/audit.service';
import { useApiCall } from '../../hooks/useApiCall';
import { AuditEvent } from '../../types/audit';

export const AdminAuditPage: React.FC = () => {
  const { data: logs, loading, error, refetch } = useApiCall<AuditEvent[]>(
    () => auditService.getAuditLogs(),
    []
  );

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">System Audit Log</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          Immutable system-level access, administrative action logs, and security events.
        </p>
      </div>

      <ApiStateWrapper
        loading={loading}
        error={error}
        isEmpty={!loading && !error && logs.length === 0}
        emptyTitle="No audit events recorded"
        emptyMessage="System audit events will appear here once users perform actions on the platform."
        onRetry={refetch}
        skeletonRows={4}
      >
        <Card padding="none" className="overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DDE5DA] text-[11px] font-bold uppercase text-[#66736A] bg-[#F8F3EA]">
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Record Type</th>
                <th className="py-3.5 px-4">Purpose</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE5DA] text-xs">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#F2E7D5]/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-[#26352A]">{log.actorName || '—'}</td>
                  <td className="py-3.5 px-4 capitalize text-[#66736A]">{log.actorRole}</td>
                  <td className="py-3.5 px-4 text-[#47634C] font-semibold">{log.recordType || '—'}</td>
                  <td className="py-3.5 px-4 text-[#66736A]">{log.purpose || '—'}</td>
                  <td className="py-3.5 px-4 text-[#66736A]">{log.timestamp}</td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={log.accessType === 'Emergency' ? 'emergency' : 'approved'} />
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge
                      status={
                        log.status === 'Revoked' ? 'revoked'
                          : log.status === 'Disputed' ? 'disputed'
                          : log.status === 'Review Required' ? 'pending'
                          : 'approved'
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </ApiStateWrapper>
    </div>
  );
};
