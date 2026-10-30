import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EditProfileModal } from '../../components/common/EditProfileModal';
import { Shield, Phone, Mail, Calendar, Edit3 } from 'lucide-react';
import { PatientUser } from '../../types/user';

export const PatientProfilePage: React.FC = () => {
  const { user } = useAuth();
  const patientUser = user as PatientUser | null;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [, setRefreshState] = useState(0);

  const formattedLastLogin = user?.lastLogin
    ? new Date(user.lastLogin).toLocaleString()
    : 'Current Active Session';

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">Patient Profile</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          Personal identification &amp; account security status.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card padding="lg" className="lg:col-span-8 space-y-6 bg-white">
          <div className="flex items-center gap-4 border-b border-[#DDE5DA] pb-6">
            <div className="w-16 h-16 rounded-full bg-[#47634C] text-[#A8CBA0] flex items-center justify-center text-2xl font-extrabold shadow-sm">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#26352A]">{user?.name || 'Patient'}</h3>
              <p className="text-xs text-[#66736A]">
                Patient ID: {patientUser?.patientId || user?.id || '—'} • Blood Group: {patientUser?.bloodGroup || 'Not specified'}
              </p>
              <Badge variant="sage" className="mt-1">Verified Sovereign Patient</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA] space-y-1">
              <span className="text-[#66736A] flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-[#47634C]" /> Email Address
              </span>
              <strong className="text-[#26352A] text-sm block">{user?.email || '—'}</strong>
            </div>

            <div className="p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA] space-y-1">
              <span className="text-[#66736A] flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-[#47634C]" /> Phone Number
              </span>
              <strong className="text-[#26352A] text-sm block">{user?.phone || 'Not specified'}</strong>
            </div>

            <div className="p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA] space-y-1">
              <span className="text-[#66736A] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#47634C]" /> Date of Birth
              </span>
              <strong className="text-[#26352A] text-sm block">{patientUser?.dob || 'Not specified'}</strong>
            </div>

            <div className="p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA] space-y-1">
              <span className="text-[#66736A] flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#47634C]" /> Role &amp; Permissions
              </span>
              <strong className="text-[#26352A] text-sm block">Full Data Owner</strong>
            </div>
          </div>

          <Button variant="secondary" icon={<Edit3 className="w-4 h-4" />} onClick={() => setIsEditModalOpen(true)}>
            Edit Profile Information
          </Button>
        </Card>

        <Card padding="lg" className="lg:col-span-4 space-y-4 bg-white">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#47634C]">Account Security</h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-[#E7F0E4] rounded-xl border border-[#A8CBA0]/60 space-y-1">
              <div className="flex justify-between font-bold text-[#47634C]">
                <span>JWT &amp; Session Auth</span>
                <span className="text-[#5F8D65]">● Active</span>
              </div>
              <p className="text-[11px] text-[#66736A]">Protected via signed JWT &amp; refresh token rotation</p>
            </div>

            <div className="p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA] space-y-1">
              <span className="text-[#66736A] block">Last Login Timestamp:</span>
              <strong className="text-[#26352A] block">{formattedLastLogin}</strong>
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
