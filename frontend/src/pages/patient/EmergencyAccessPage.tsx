import React, { useState, useEffect } from 'react';
import { emergencyService } from '../../services/emergency.service';
import { EmergencyEvent } from '../../types/emergency';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { useApiCall } from '../../hooks/useApiCall';
import { useNotification } from '../../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, ShieldAlert, Clock, Ban, AlertTriangle } from 'lucide-react';

export const EmergencyAccessPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useNotification();
  const { data: events, loading, error, refetch } = useApiCall<EmergencyEvent[]>(
    () => emergencyService.getEmergencyEvents(),
    []
  );
  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EmergencyEvent | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const loadActive = () => {
    emergencyService
      .getActiveEmergencies()
      .then(setActiveEmergencies)
      .catch(() => setActiveEmergencies([]));
  };

  useEffect(() => {
    loadActive();
  }, []);

  const handleRevoke = async (id: string) => {
    setIsRevoking(true);
    try {
      await emergencyService.revokeEmergencyAccess(id);
      showToast('Break-glass emergency session revoked immediately!', 'success');
      loadActive();
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to revoke emergency access', 'error');
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">Emergency Access Log</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          Review break-glass emergency access events invoked for critical care delivery.
        </p>
      </div>

      {/* Active Live Emergency Sessions Card */}
      {activeEmergencies.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-red-950">
            <AlertOctagon className="w-4 h-4 text-red-600 animate-spin" />
            <span>Currently Active Break-Glass Emergency Sessions</span>
          </div>
          {activeEmergencies.map((emg) => (
            <Card key={emg.id} padding="lg" className="bg-red-50/80 border-2 border-red-300 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center font-bold text-lg">
                    🚨
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#26352A]">{emg.doctorName}</h3>
                    <p className="text-xs text-[#66736A]">{emg.hospital} • Live Break-Glass Session</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="danger">Active Session</Badge>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Ban className="w-3.5 h-3.5" />}
                    onClick={() => handleRevoke(emg.id)}
                    isLoading={isRevoking}
                  >
                    Immediate Revoke
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-white/80 rounded-xl text-xs border border-red-200">
                <div>
                  <span className="text-[#66736A] block">Access Tier</span>
                  <strong className="text-[#26352A] text-sm">Tier {emg.accessLevel === 'Full' ? '2 (Full History)' : '1 (Partial)'}</strong>
                </div>
                <div>
                  <span className="text-[#66736A] block">Auto-Revoke Expiration</span>
                  <strong className="text-red-700 font-mono">
                    {emg.autoRevokeTimestamp ? new Date(emg.autoRevokeTimestamp).toLocaleTimeString() : '15 min window'}
                  </strong>
                </div>
                <div>
                  <span className="text-[#66736A] block">Reason / Justification</span>
                  <span className="text-[#26352A] font-medium">{emg.reason}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ApiStateWrapper
        loading={loading}
        error={error}
        isEmpty={!loading && !error && events.length === 0}
        emptyTitle="No emergency access events"
        emptyMessage="No break-glass emergency overrides have been invoked on your medical records."
        onRetry={refetch}
        skeletonRows={3}
      >
        <div className="space-y-4">
          {events.map((evt) => (
            <Card key={evt.id} padding="lg" className="space-y-4 bg-white border-[#DDE5DA]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#fceded] text-[#C85C5C] flex items-center justify-center font-bold text-lg">
                    🚨
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#26352A]">{evt.doctorName}</h3>
                    <p className="text-xs text-[#66736A]">{evt.hospital} • Emergency Access</p>
                  </div>
                </div>
                <StatusBadge status="emergency" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-[#F8F3EA] rounded-xl text-xs">
                <div>
                  <span className="text-[#66736A] block">Access Level</span>
                  <strong className="text-[#26352A] text-sm">{evt.accessLevel} Access</strong>
                </div>
                <div>
                  <span className="text-[#66736A] block">Timestamp</span>
                  <strong className="text-[#26352A]">{evt.requestedAt}</strong>
                </div>
                <div>
                  <span className="text-[#66736A] block">Hospital Identity</span>
                  <span className="text-[#5F8D65] font-bold">✓ Verified</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-[#47634C] block mb-1.5">Records Accessed:</span>
                <div className="flex flex-wrap gap-2">
                  {(evt.recordsAccessed || []).map((rec, idx) => (
                    <Badge key={idx} variant="sage">
                      {rec}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#DDE5DA]">
                <span className="text-xs text-[#66736A]">
                  Reconciliation Status:{' '}
                  <strong className={evt.reconciliationStatus === 'disputed' ? 'text-[#C85C5C]' : 'text-[#D9A441]'}>
                    {evt.reconciliationStatus.toUpperCase()}
                  </strong>
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedEvent(evt)}>
                    View Event Details
                  </Button>
                  {evt.reconciliationStatus !== 'disputed' ? (
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<AlertTriangle className="w-3.5 h-3.5" />}
                      onClick={() =>
                        navigate('/patient/disputes', {
                          state: {
                            eventId: evt.id,
                            doctorName: evt.doctorName,
                            hospital: evt.hospital,
                          },
                        })
                      }
                    >
                      Dispute Event
                    </Button>
                  ) : (
                    <Badge variant="danger">Dispute Under Review</Badge>
                  )}
                  <Button variant="primary" size="sm" onClick={() => navigate('/patient/reconciliation')}>
                    Reconciliation
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ApiStateWrapper>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title="Emergency Access Event"
        subtitle={selectedEvent?.id}
      >
        {selectedEvent && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-[#fceded] rounded-2xl border border-[#f8c4c4] space-y-2">
              <div className="flex justify-between font-bold text-[#C85C5C]">
                <span>Emergency Break-Glass Invoked</span>
                <span>{selectedEvent.accessLevel} Level</span>
              </div>
              <p className="text-[#26352A]">{selectedEvent.reason}</p>
            </div>

            <div className="space-y-2 p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
              <div className="flex justify-between">
                <span className="text-[#66736A]">Doctor:</span>
                <strong className="text-[#26352A]">{selectedEvent.doctorName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#66736A]">Hospital:</span>
                <strong className="text-[#26352A]">{selectedEvent.hospital}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#66736A]">Emergency Code:</span>
                <code className="text-[#47634C] font-mono">{selectedEvent.emergencyCode || 'HOSPITAL-VERIFIED-AUTH'}</code>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setSelectedEvent(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
