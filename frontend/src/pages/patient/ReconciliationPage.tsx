import React from 'react';
import { emergencyService } from '../../services/emergency.service';
import { EmergencyEvent } from '../../types/emergency';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { useNotification } from '../../context/NotificationContext';
import { useApiCall } from '../../hooks/useApiCall';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

export const ReconciliationPage: React.FC = () => {
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const { data: events, loading, error, refetch } = useApiCall<EmergencyEvent[]>(
    () => emergencyService.getEmergencyEvents(),
    []
  );

  const handleAcknowledge = async (eventId: string) => {
    try {
      await emergencyService.acknowledgeEmergencyAccess(eventId);
      showToast('Emergency access event acknowledged', 'success');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to acknowledge event', 'error');
    }
  };

  const handleRaiseDispute = (evt: EmergencyEvent) => {
    navigate('/patient/disputes', { state: { eventId: evt.id, doctorName: evt.doctorName, hospital: evt.hospital } });
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">Post-Emergency Reconciliation</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          Review completed break-glass emergency access events for post-hoc verification or dispute submission.
        </p>
      </div>

      <ApiStateWrapper
        loading={loading}
        error={error}
        isEmpty={!loading && !error && events.length === 0}
        emptyTitle="No emergency events to reconcile"
        emptyMessage="No break-glass emergency overrides require reconciliation at this time."
        onRetry={refetch}
        skeletonRows={3}
      >
        <div className="space-y-4">
          {events.map((evt) => (
            <Card key={evt.id} padding="lg" className="space-y-4 bg-white border-[#DDE5DA]">
              <div className="flex items-center justify-between border-b border-[#DDE5DA] pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[#C85C5C]" />
                  <h3 className="text-base font-bold text-[#26352A]">Post-Emergency Review</h3>
                </div>
                <Badge variant={evt.reconciliationStatus === 'acknowledged' ? 'success' : evt.reconciliationStatus === 'disputed' ? 'danger' : 'warning'}>
                  Reconciliation: {evt.reconciliationStatus.toUpperCase()}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-[#F8F3EA] rounded-xl text-xs">
                <div>
                  <span className="text-[#66736A] block">Clinician</span>
                  <strong className="text-[#26352A] text-sm">{evt.doctorName}</strong>
                  <span className="text-[11px] text-[#66736A] block">{evt.hospital}</span>
                </div>
                <div>
                  <span className="text-[#66736A] block">Access Scope</span>
                  <strong className="text-[#26352A] text-sm">{evt.accessLevel} Emergency Access</strong>
                </div>
                <div>
                  <span className="text-[#66736A] block">Time Window</span>
                  <span className="font-semibold text-[#26352A]">{evt.requestedAt}</span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <span className="font-semibold text-[#47634C] block">Stated Emergency Reason:</span>
                <p className="p-3 bg-[#fceded]/60 border border-[#f8c4c4] rounded-xl text-[#26352A]">
                  {evt.reason}
                </p>
              </div>

              <div className="space-y-1.5 text-xs">
                <span className="font-semibold text-[#47634C] block">Records Accessed During Break-Glass:</span>
                <div className="flex flex-wrap gap-2">
                  {(evt.recordsAccessed || []).map((rec, i) => (
                    <Badge key={i} variant="sage">{rec}</Badge>
                  ))}
                </div>
              </div>

              {/* Decision Bar */}
              <div className="pt-3 border-t border-[#DDE5DA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-[#66736A]">
                  Was this emergency break-glass access legitimate and appropriate?
                </span>

                {evt.reconciliationStatus === 'pending' ? (
                  <div className="flex items-center gap-3">
                    <Button variant="danger" size="sm" icon={<AlertTriangle className="w-4 h-4" />} onClick={() => handleRaiseDispute(evt)}>
                      Raise Dispute
                    </Button>
                    <Button variant="primary" size="sm" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => handleAcknowledge(evt.id)}>
                      Acknowledge Access
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs font-bold text-[#5F8D65] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Reconciliation Review Completed ({evt.reconciliationStatus})
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </ApiStateWrapper>
    </div>
  );
};
