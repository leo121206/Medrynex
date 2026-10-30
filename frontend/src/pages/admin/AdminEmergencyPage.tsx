import React from 'react';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { emergencyService } from '../../services/emergency.service';
import { useApiCall } from '../../hooks/useApiCall';
import { EmergencyEvent } from '../../types/emergency';

export const AdminEmergencyPage: React.FC = () => {
  const { data: events, loading, error, refetch } = useApiCall<EmergencyEvent[]>(
    () => emergencyService.getEmergencyEvents(),
    []
  );

  const pendingCount = events.filter((e) => e.reconciliationStatus === 'pending').length;
  const acknowledgedCount = events.filter((e) => e.reconciliationStatus === 'acknowledged').length;
  const disputedCount = events.filter((e) => e.reconciliationStatus === 'disputed').length;

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">Emergency Events Monitoring</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          Administrative platform monitoring of all break-glass emergency invocations.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card padding="md" className="bg-[#fceded] border-[#f8c4c4]">
          <span className="text-xs font-semibold text-[#C85C5C]">Pending Review</span>
          <h4 className="text-2xl font-extrabold text-[#C85C5C]">{loading ? '…' : pendingCount}</h4>
        </Card>
        <Card padding="md" className="bg-[#E7F0E4] border-[#A8CBA0]">
          <span className="text-xs font-semibold text-[#47634C]">Acknowledged</span>
          <h4 className="text-2xl font-extrabold text-[#5F8D65]">{loading ? '…' : acknowledgedCount}</h4>
        </Card>
        <Card padding="md" className="bg-[#fcf5e5] border-[#D9A441]">
          <span className="text-xs font-semibold text-[#D9A441]">Disputed</span>
          <h4 className="text-2xl font-extrabold text-[#D9A441]">{loading ? '…' : disputedCount}</h4>
        </Card>
      </div>

      <ApiStateWrapper
        loading={loading}
        error={error}
        isEmpty={!loading && !error && events.length === 0}
        emptyTitle="No emergency break-glass events recorded"
        emptyMessage="Break-glass emergency access events will appear here when invoked by clinicians."
        onRetry={refetch}
        skeletonRows={3}
      >
        <Card padding="lg" className="bg-white space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#47634C]">Emergency Events Logged</h3>
          <div className="space-y-4">
            {events.map((evt) => (
              <div key={evt.id} className="p-4 bg-[#F8F3EA] rounded-2xl border border-[#DDE5DA] space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#C85C5C] flex items-center gap-1.5">
                    🚨 {evt.requestedAt} — {evt.doctorName} ({evt.hospital})
                  </span>
                  <StatusBadge status={evt.reconciliationStatus === 'pending' ? 'emergency' : evt.reconciliationStatus === 'disputed' ? 'disputed' : 'approved'} />
                </div>
                <p className="text-[#26352A]">
                  {evt.accessLevel} Emergency Access • {evt.reason} • Patient {evt.patientId}
                </p>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#5F8D65] font-semibold">✓ Cryptographically Logged &amp; Anchored</span>
                  <span className="text-[#66736A]">Reconciliation: <strong className="capitalize">{evt.reconciliationStatus}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </ApiStateWrapper>
    </div>
  );
};
