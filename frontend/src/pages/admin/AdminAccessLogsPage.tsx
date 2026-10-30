import React from 'react';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { auditService } from '../../services/audit.service';
import { useApiCall } from '../../hooks/useApiCall';
import { AuditEvent } from '../../types/audit';

export const AdminAccessLogsPage: React.FC = () => {
  const { data: logs, loading, error, refetch } = useApiCall<AuditEvent[]>(
    () => auditService.getAuditLogs(),
    []
  );

  const totalAccess = logs.length;
  const normalAccess = logs.filter((l) => l.accessType === 'Normal').length;
  const emergencyEvents = logs.filter((l) => l.accessType === 'Emergency').length;
  const anomalies = logs.filter((l) => l.accessType === 'Dispute').length;

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">Access Monitoring</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          Platform-wide real-time audit logs of all access transactions.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md" className="bg-white">
          <span className="text-xs text-[#66736A] font-semibold">Total Access Events</span>
          <h4 className="text-2xl font-extrabold text-[#26352A]">
            {loading ? '…' : totalAccess}
          </h4>
        </Card>
        <Card padding="md" className="bg-white">
          <span className="text-xs text-[#66736A] font-semibold">Normal Access</span>
          <h4 className="text-2xl font-extrabold text-[#5F8D65]">
            {loading ? '…' : normalAccess}
          </h4>
        </Card>
        <Card padding="md" className="bg-white">
          <span className="text-xs text-[#66736A] font-semibold">Emergency Events</span>
          <h4 className="text-2xl font-extrabold text-[#C85C5C]">
            {loading ? '…' : emergencyEvents}
          </h4>
        </Card>
        <Card padding="md" className="bg-white">
          <span className="text-xs text-[#66736A] font-semibold">Flagged / Disputed</span>
          <h4 className="text-2xl font-extrabold text-[#D9A441]">
            {loading ? '…' : anomalies}
          </h4>
        </Card>
      </div>

      <ApiStateWrapper
        loading={loading}
        error={error}
        isEmpty={!loading && !error && logs.length === 0}
        emptyTitle="No access events logged"
        emptyMessage="Platform access logs will appear here once clinicians or patients interact with records."
        onRetry={refetch}
        skeletonRows={4}
      >
        <Card padding="none" className="overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DDE5DA] text-[11px] font-bold uppercase text-[#66736A] bg-[#F8F3EA]">
                <th className="py-3.5 px-4">Clinician / Actor</th>
                <th className="py-3.5 px-4">Patient Target</th>
                <th className="py-3.5 px-4">Record Scope</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Access Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE5DA] text-xs">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#F2E7D5]/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-[#26352A]">{log.actorName || '—'}</td>
                  <td className="py-3.5 px-4 text-[#66736A]">{log.patientId || '—'}</td>
                  <td className="py-3.5 px-4 text-[#47634C] font-semibold">{log.recordType || '—'}</td>
                  <td className="py-3.5 px-4 text-[#66736A]">{log.timestamp}</td>
                  <td className="py-3.5 px-4">
                    <StatusBadge
                      status={
                        log.accessType === 'Emergency'
                          ? 'emergency'
                          : log.accessType === 'Dispute'
                          ? 'disputed'
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
