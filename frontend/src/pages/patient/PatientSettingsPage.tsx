import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useNotification } from '../../context/NotificationContext';
import { Bell, Lock, Shield, Eye } from 'lucide-react';

export const PatientSettingsPage: React.FC = () => {
  const { showToast } = useNotification();
  const [accessReqNotif, setAccessReqNotif] = useState(true);
  const [emergencyNotif, setEmergencyNotif] = useState(true);
  const [auditNotif, setAuditNotif] = useState(true);
  const [batchNotif, setBatchNotif] = useState(true);

  const handleSave = () => {
    showToast('Privacy & Notification preferences updated successfully', 'success');
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">Patient Settings</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          Configure privacy preferences, alert channels, and security settings.
        </p>
      </div>

      <Card padding="lg" className="max-w-3xl space-y-6 bg-white">
        <div className="border-b border-[#DDE5DA] pb-4">
          <h3 className="text-base font-bold text-[#26352A] flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#47634C]" /> Privacy & Consent Preferences
          </h3>
          <p className="text-xs text-[#66736A] mt-0.5">Control how clinicians and AI anomaly engines notify you</p>
        </div>

        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between p-3.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
            <div>
              <strong className="text-[#26352A] block text-sm">Access Request Notifications</strong>
              <span className="text-[#66736A]">Receive instant alert when a clinician requests a new record scope</span>
            </div>
            <input
              type="checkbox"
              checked={accessReqNotif}
              onChange={(e) => setAccessReqNotif(e.target.checked)}
              className="w-5 h-5 accent-[#47634C] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
            <div>
              <strong className="text-[#26352A] block text-sm">Emergency Break-Glass Notifications</strong>
              <span className="text-[#66736A]">High priority SMS & Push alert during any emergency access invocation</span>
            </div>
            <input
              type="checkbox"
              checked={emergencyNotif}
              onChange={(e) => setEmergencyNotif(e.target.checked)}
              className="w-5 h-5 accent-[#47634C] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
            <div>
              <strong className="text-[#26352A] block text-sm">Audit Trail Notifications</strong>
              <span className="text-[#66736A]">Receive log summaries whenever a record is accessed by a clinician</span>
            </div>
            <input
              type="checkbox"
              checked={auditNotif}
              onChange={(e) => setAuditNotif(e.target.checked)}
              className="w-5 h-5 accent-[#47634C] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-3.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
            <div>
              <strong className="text-[#26352A] block text-sm">Consent Batch Notifications</strong>
              <span className="text-[#66736A]">Group related low-risk care team requests automatically into single batches</span>
            </div>
            <input
              type="checkbox"
              checked={batchNotif}
              onChange={(e) => setBatchNotif(e.target.checked)}
              className="w-5 h-5 accent-[#47634C] cursor-pointer"
            />
          </div>
        </div>

        <div className="pt-2">
          <Button variant="primary" onClick={handleSave}>
            Save Settings
          </Button>
        </div>
      </Card>
    </div>
  );
};
