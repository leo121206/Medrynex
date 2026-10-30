import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { Search, Plus, UserPlus, ShieldCheck, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  relationshipService,
  DoctorPatientDirectoryEntry,
} from '../../services/relationship.service';
import { useApiCall } from '../../hooks/useApiCall';
import { useNotification } from '../../context/NotificationContext';

export const PatientsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useNotification();
  const { data: patients, loading, error, refetch } = useApiCall<DoctorPatientDirectoryEntry[]>(
    () => relationshipService.getPatientDirectory(),
    []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [establishingId, setEstablishingId] = useState<string | null>(null);

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInitiateTrust = async (patient: DoctorPatientDirectoryEntry) => {
    setEstablishingId(patient.id);
    try {
      await relationshipService.createRelationship({
        relationshipType: 'PATIENT_PROVIDER',
        targetId: patient.id,
        notes: 'Clinical care provider verification request (T0 -> T1)',
      });
      showToast(`Trust relationship request sent to ${patient.name}`, 'success');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to request relationship', 'error');
    } finally {
      setEstablishingId(null);
    }
  };

  const getTierBadgeVariant = (tier: string) => {
    if (tier === 'T3') return 'sage';
    if (tier === 'T2') return 'success';
    if (tier === 'T1') return 'warning';
    return 'neutral';
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#26352A]">
            Patient Directory &amp; Trust Hierarchy (T0–T3)
          </h2>
          <p className="text-xs text-[#66736A] mt-0.5">
            Establish verified clinical relationships (T1) and request consolidated patient-level access scopes (T2/T3).
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => navigate('/doctor/access-requests')}
        >
          Request Patient-Level Scope
        </Button>
      </div>

      <Card padding="md" className="bg-white">
        <Input
          placeholder="Search patient by name or Patient ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />
      </Card>

      <ApiStateWrapper
        loading={loading}
        error={error}
        isEmpty={!loading && !error && filteredPatients.length === 0}
        emptyTitle="No patients found"
        emptyMessage="No patient profiles match your current search."
        onRetry={refetch}
        skeletonRows={3}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPatients.map((p) => (
            <Card key={p.id} padding="lg" hoverable className="space-y-4 bg-white border-[#DDE5DA]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#E7F0E4] text-[#47634C] flex items-center justify-center font-bold text-lg">
                    👤
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#26352A]">{p.name}</h3>
                    <p className="text-xs text-[#66736A]">
                      ID: {p.patientId} • Blood Group: {p.bloodGroup}
                    </p>
                  </div>
                </div>
                <Badge variant={getTierBadgeVariant(p.trustTier)}>
                  {p.tierLabel}
                </Badge>
              </div>

              <div className="p-3.5 bg-[#F8F3EA] rounded-xl text-xs space-y-2 border border-[#DDE5DA]">
                <div className="flex justify-between">
                  <span className="text-[#66736A]">Relationship Status:</span>
                  <strong className="text-[#26352A]">{p.relationshipStatus}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#66736A]">On-File Record Categories ({p.totalRecordsCount} docs):</span>
                  <span className="font-semibold text-[#47634C]">
                    {p.availableCategories.length > 0 ? p.availableCategories.join(', ') : 'None uploaded'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#66736A]">Authorized Patient-Level Scope:</span>
                  <span className="font-bold text-[#5F8D65]">
                    {p.authorizedCategories.length > 0
                      ? p.authorizedCategories.join(', ')
                      : 'No Active Consent Grant'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#DDE5DA]">
                {p.trustTier === 'T0' && p.relationshipStatus !== 'PENDING' && (
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={establishingId === p.id}
                    icon={<UserPlus className="w-3.5 h-3.5" />}
                    onClick={() => handleInitiateTrust(p)}
                  >
                    Establish Trust (T0 → T1)
                  </Button>
                )}
                {p.trustTier === 'T0' && p.relationshipStatus === 'PENDING' && (
                  <Badge variant="warning">Pending Patient Acceptance (T0 → T1)</Badge>
                )}
                {p.canRequestPatientAccess && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<ShieldCheck className="w-3.5 h-3.5" />}
                    onClick={() => navigate(`/doctor/access-requests?patientId=${p.id}`)}
                  >
                    Request Patient-Level Scope
                  </Button>
                )}
                {p.canViewProtectedRecords && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<FolderOpen className="w-3.5 h-3.5" />}
                    onClick={() => navigate('/doctor/authorized-records')}
                  >
                    View All Authorized Records
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </ApiStateWrapper>
    </div>
  );
};

