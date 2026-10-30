import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useNotification } from '../../context/NotificationContext';

export const AdminSettingsPage: React.FC = () => {
  const { showToast } = useNotification();

  const handleSave = () => {
    showToast('Platform security thresholds saved!', 'success');
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">System Settings</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          Configure global ML risk score thresholds, Ganache RPC endpoints, and IPFS node URLs.
        </p>
      </div>

      <Card padding="lg" className="max-w-2xl bg-white space-y-4 text-xs">
        <div className="space-y-1.5">
          <label className="block font-bold text-[#47634C]">Ganache Ethereum RPC Endpoint</label>
          <input type="text" defaultValue="http://127.0.0.1:8545" className="medrynx-input" />
        </div>

        <div className="space-y-1.5">
          <label className="block font-bold text-[#47634C]">IPFS Storage Cluster Multiaddr</label>
          <input type="text" defaultValue="/ip4/127.0.0.1/tcp/5001" className="medrynx-input" />
        </div>

        <div className="space-y-1.5">
          <label className="block font-bold text-[#47634C]">AI Anomaly High-Risk Threshold Score (0-100)</label>
          <input type="number" defaultValue={80} className="medrynx-input" />
        </div>

        <Button variant="primary" onClick={handleSave}>
          Save System Configuration
        </Button>
      </Card>
    </div>
  );
};
