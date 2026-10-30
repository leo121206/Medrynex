import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useNotification } from '../../context/NotificationContext';
import { Settings, Bell, Lock } from 'lucide-react';

export const DoctorSettingsPage: React.FC = () => {
  const { showToast } = useNotification();

  const handleSave = () => {
    showToast('Doctor clinical preferences updated', 'success');
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">Doctor Settings</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          Configure notifications for patient consent approvals and emergency overrides.
        </p>
      </div>

      <Card padding="lg" className="max-w-2xl bg-white space-y-4">
        <div className="border-b border-[#DDE5DA] pb-3">
          <h3 className="text-base font-bold text-[#26352A]">Notification Preferences</h3>
        </div>

        <div className="space-y-3 text-xs">
          <label className="flex items-center justify-between p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
            <div>
              <strong className="text-[#26352A] block">Consent Approval Alerts</strong>
              <span className="text-[#66736A]">Notify immediately when a patient grants requested scope</span>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 accent-[#47634C]" />
          </label>

          <label className="flex items-center justify-between p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
            <div>
              <strong className="text-[#26352A] block">Reconciliation Status Alerts</strong>
              <span className="text-[#66736A]">Receive alerts when emergency access is acknowledged or disputed</span>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5 accent-[#47634C]" />
          </label>
        </div>

        <Button variant="primary" onClick={handleSave}>
          Save Doctor Settings
        </Button>
      </Card>
    </div>
  );
};
