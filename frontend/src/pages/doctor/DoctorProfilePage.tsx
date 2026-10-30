import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EditProfileModal } from '../../components/common/EditProfileModal';
import { Award, Building, Mail, Stethoscope, ShieldCheck, Edit3 } from 'lucide-react';
import { DoctorUser } from '../../types/user';
import { adminService } from '../../services/admin.service';
import { consentService } from '../../services/consent.service';
import { aimlService } from '../../services/aiml.service';
import { useApiCall } from '../../hooks/useApiCall';

export const DoctorProfilePage: React.FC = () => {
  const { user } = useAuth();
  const docUser = user as DoctorUser | null;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [, setRefreshState] = useState(0);

  const { data: patients, loading: patientsLoading } = useApiCall(
    () => adminService.getPatients(),
    []
  );
  const { data: activeConsents, loading: consentsLoading } = useApiCall(
    () => consentService.getActiveConsents(),
    []
  );
  const { data: aiSummary, loading: aiLoading } = useApiCall(
    () => aimlService.getSummary(),
    null
  );

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">Doctor Profile</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          Medical license verification &amp; hospital credential summary.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card padding="lg" className="lg:col-span-8 bg-white space-y-6">
          <div className="flex items-center gap-4 border-b border-[#DDE5DA] pb-6">
            <div className="w-16 h-16 rounded-full bg-[#47634C] text-[#A8CBA0] flex items-center justify-center text-2xl font-extrabold">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'D'}
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#26352A]">{user?.name || 'Clinician'}</h3>
              <p className="text-xs text-[#66736A]">
                {docUser?.specialization || 'General Medicine'} • {docUser?.hospital || 'Affiliated Facility'}
              </p>
              <Badge
                variant={docUser?.verificationStatus === 'verified' ? 'success' : 'warning'}
                className="mt-1"
                icon={<ShieldCheck className="w-3.5 h-3.5" />}
              >
                {docUser?.verificationStatus === 'verified'
                  ? 'MCI License Verified ✓'
                  : `Verification: ${docUser?.verificationStatus || 'Pending'}`}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA] space-y-1">
              <span className="text-[#66736A] flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-[#47634C]" /> Medical License ID
              </span>
              <strong className="text-[#26352A] text-sm block">{docUser?.licenseId || 'Not specified'}</strong>
            </div>

            <div className="p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA] space-y-1">
              <span className="text-[#66736A] flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-[#47634C]" /> Primary Hospital
              </span>
              <strong className="text-[#26352A] text-sm block">{docUser?.hospital || 'Not specified'}</strong>
            </div>

            <div className="p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA] space-y-1">
              <span className="text-[#66736A] flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5 text-[#47634C]" /> Specialization
              </span>
              <strong className="text-[#26352A] text-sm block">{docUser?.specialization || 'Not specified'}</strong>
            </div>

            <div className="p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA] space-y-1">
              <span className="text-[#66736A] flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#47634C]" /> Institutional Email
              </span>
              <strong className="text-[#26352A] text-sm block">{user?.email || '—'}</strong>
            </div>
          </div>

          <Button variant="secondary" icon={<Edit3 className="w-4 h-4" />} onClick={() => setIsEditModalOpen(true)}>
            Edit Profile Information
          </Button>
        </Card>

        <Card padding="lg" className="lg:col-span-4 bg-white space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#47634C]">Clinical Activity</h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-[#DDE5DA]">
              <span className="text-[#66736A]">Active Patients</span>
              <strong className="text-[#26352A]">{patientsLoading ? '…' : patients.length}</strong>
            </div>
            <div className="flex justify-between py-1 border-b border-[#DDE5DA]">
              <span className="text-[#66736A]">Authorized Record Scopes</span>
              <strong className="text-[#5F8D65]">{consentsLoading ? '…' : activeConsents.length}</strong>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#66736A]">AI Risk Avg Score</span>
              <strong className="text-[#D9A441]">
                {aiLoading
                  ? '…'
                  : aiSummary
                  ? `${aiSummary.averageScore.toFixed(1)} / 100`
                  : '—'}
              </strong>
            </div>
          </div>
        </Card>
      </div>

      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSaveSuccess={() => setRefreshState((prev) => prev + 1)}
      />
    </div>
  );
};
