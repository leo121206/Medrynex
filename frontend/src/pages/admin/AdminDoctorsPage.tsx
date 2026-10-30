import React from 'react';
import { adminService } from '../../services/admin.service';
import { DoctorVerification } from '../../types/admin';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { useNotification } from '../../context/NotificationContext';
import { useApiCall } from '../../hooks/useApiCall';

export const AdminDoctorsPage: React.FC = () => {
  const { showToast } = useNotification();
  const { data: doctors, loading, error, refetch } = useApiCall<DoctorVerification[]>(
    () => adminService.getDoctorVerifications(),
    []
  );

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'verified' ? 'suspended' : 'verified';
    try {
      await adminService.toggleDoctorStatus(id, nextStatus);
      showToast(`Doctor license status updated to ${nextStatus}`, 'info');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update doctor status', 'error');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#26352A]">Doctor Management</h2>
          <p className="text-xs text-[#66736A] mt-0.5">
            Verify medical council licenses and manage institutional hospital affiliations.
          </p>
        </div>
        <Badge variant="sage" className="text-xs font-bold px-3 py-1">
          {loading ? '…' : doctors.length} Registered Doctors
        </Badge>
      </div>

      <ApiStateWrapper
        loading={loading}
        error={error}
        isEmpty={!loading && !error && doctors.length === 0}
        emptyTitle="No registered doctors"
        emptyMessage="Clinician accounts will appear here once doctors register on the platform."
        onRetry={refetch}
        skeletonRows={3}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {doctors.map((doc) => (
            <Card key={doc.id} padding="lg" className="space-y-4 bg-white border-[#DDE5DA]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#E7F0E4] text-[#47634C] flex items-center justify-center font-bold text-lg">
                    🩺
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#26352A]">{doc.doctorName}</h3>
                    <p className="text-xs text-[#66736A]">{doc.specialization} • {doc.hospital}</p>
                  </div>
                </div>
                <StatusBadge status={doc.status === 'verified' ? 'verified' : doc.status === 'pending' ? 'pending' : 'rejected'} />
              </div>

              <div className="p-3 bg-[#F8F3EA] rounded-xl text-xs space-y-1.5 border border-[#DDE5DA]">
                <div className="flex justify-between">
                  <span className="text-[#66736A]">Medical License ID:</span>
                  <strong className="text-[#47634C] font-mono">{doc.licenseId || '—'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#66736A]">Registration Date:</span>
                  <span>{doc.submittedAt || '—'}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#DDE5DA]">
                <Button
                  variant={doc.status === 'verified' ? 'danger' : 'primary'}
                  size="sm"
                  onClick={() => handleToggleStatus(doc.id, doc.status)}
                >
                  {doc.status === 'verified' ? 'Suspend License' : 'Verify & Activate'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </ApiStateWrapper>
    </div>
  );
};
