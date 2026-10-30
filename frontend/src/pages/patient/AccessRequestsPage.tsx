import React, { useState } from 'react';
import { consentService } from '../../services/consent.service';
import { AccessRequest, RequestStatus } from '../../types/access';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { RiskIndicator } from '../../components/ui/RiskIndicator';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { ScopedConsentModal } from '../../components/patient/ScopedConsentModal';
import { useNotification } from '../../context/NotificationContext';
import { useApiCall } from '../../hooks/useApiCall';
import { CheckCircle2, Ban } from 'lucide-react';

export const AccessRequestsPage: React.FC = () => {
  const { showToast } = useNotification();
  const { data: requests, loading, error, refetch } = useApiCall<AccessRequest[]>(
    () => consentService.getAccessRequests(),
    []
  );
  const [activeTab, setActiveTab] = useState<RequestStatus>('pending');
  const [selectedRequestForReview, setSelectedRequestForReview] = useState<AccessRequest | null>(null);

  const handleReject = async (id: string) => {
    try {
      await consentService.rejectRequest(id);
      showToast('Access request rejected', 'info');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reject request', 'error');
    }
  };

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length;
  const expiredCount = requests.filter((r) => r.status === 'expired').length;

  const currentTabRequests = requests.filter((r) => r.status === activeTab);

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">Access Requests</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          Review clinician authorization requests evaluated by AI Anomaly Detection.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap bg-white p-1.5 rounded-2xl border border-[#DDE5DA] text-xs font-bold text-[#47634C] gap-1">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2 px-4 rounded-xl transition-all ${
            activeTab === 'pending' ? 'bg-[#A8CBA0] text-[#26352A] shadow-xs' : 'hover:bg-[#F2E7D5]/60'
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`flex-1 py-2 px-4 rounded-xl transition-all ${
            activeTab === 'approved' ? 'bg-[#A8CBA0] text-[#26352A] shadow-xs' : 'hover:bg-[#F2E7D5]/60'
          }`}
        >
          Approved ({approvedCount})
        </button>
        <button
          onClick={() => setActiveTab('rejected')}
          className={`flex-1 py-2 px-4 rounded-xl transition-all ${
            activeTab === 'rejected' ? 'bg-[#A8CBA0] text-[#26352A] shadow-xs' : 'hover:bg-[#F2E7D5]/60'
          }`}
        >
          Rejected ({rejectedCount})
        </button>
        <button
          onClick={() => setActiveTab('expired')}
          className={`flex-1 py-2 px-4 rounded-xl transition-all ${
            activeTab === 'expired' ? 'bg-[#A8CBA0] text-[#26352A] shadow-xs' : 'hover:bg-[#F2E7D5]/60'
          }`}
        >
          Expired ({expiredCount})
        </button>
      </div>

      <ApiStateWrapper
        loading={loading}
        error={error}
        isEmpty={!loading && !error && currentTabRequests.length === 0}
        emptyTitle={`No ${activeTab} requests`}
        emptyMessage={`There are currently no clinician access requests with "${activeTab}" status.`}
        onRetry={refetch}
        skeletonRows={3}
      >
        <div className="space-y-4">
          {currentTabRequests.map((req) => (
            <Card key={req.id} padding="lg" className="space-y-4 bg-white border-[#DDE5DA]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#E7F0E4] text-[#47634C] flex items-center justify-center font-bold text-lg">
                    🩺
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-[#26352A]">{req.doctorName}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E7F0E4] text-[#26352A] border border-[#A8CBA0]">
                        {(req as any).tierLabel || 'T1 — Verified Relationship'}
                      </span>
                    </div>
                    <p className="text-xs text-[#66736A]">
                      {req.hospital} • {req.doctorSpecialty}
                    </p>
                  </div>
                </div>
                <StatusBadge status={req.status} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 bg-[#F8F3EA] rounded-xl text-xs">
                <div className="sm:col-span-2">
                  <span className="text-[#66736A] block mb-1">Requested Patient-Level Category Scope</span>
                  <div className="flex flex-wrap gap-1.5">
                    {((req as any).categories || req.recordType.split(',').map((s: string) => s.trim())).map(
                      (cat: string) => (
                        <span
                          key={cat}
                          className="px-2 py-0.5 rounded-lg bg-white border border-[#A8CBA0] text-[#26352A] font-bold text-[11px]"
                        >
                          {cat}
                        </span>
                      )
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[#66736A] block">Clinical Purpose</span>
                  <strong className="text-[#26352A]">{req.purpose}</strong>
                </div>
                <div>
                  <span className="text-[#66736A] block">Duration / Requested On</span>
                  <strong className="text-[#26352A]">{req.durationDays} Days</strong>
                  <span className="text-[#66736A] block text-[11px]">{req.requestedAt}</span>
                </div>
              </div>

              {/* AI Anomaly Risk Assessment Box */}
              <RiskIndicator assessment={req.riskAssessment} />

              {req.status === 'pending' && (
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#DDE5DA]">
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Ban className="w-4 h-4" />}
                    onClick={() => handleReject(req.id)}
                  >
                    Reject Request
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    onClick={() => setSelectedRequestForReview(req)}
                  >
                    Grant Scoped Access
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </ApiStateWrapper>

      {/* Scoped Consent Modal */}
      {selectedRequestForReview && (
        <ScopedConsentModal
          isOpen={!!selectedRequestForReview}
          onClose={() => setSelectedRequestForReview(null)}
          request={selectedRequestForReview}
          onSuccess={() => {
            setSelectedRequestForReview(null);
            refetch();
          }}
        />
      )}
    </div>
  );
};
