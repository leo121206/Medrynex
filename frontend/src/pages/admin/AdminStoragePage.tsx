import React from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { Database } from 'lucide-react';
import { adminService } from '../../services/admin.service';
import { useApiCall } from '../../hooks/useApiCall';
import { StorageMetrics } from '../../types/admin';

export const AdminStoragePage: React.FC = () => {
  const { data: metrics, loading, error, refetch } = useApiCall<StorageMetrics | null>(
    () => adminService.getStorageMetrics(),
    null
  );

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">Storage Status</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          IPFS off-chain storage cluster health, hash anchoring, and file replication metrics.
        </p>
      </div>

      <ApiStateWrapper
        loading={loading}
        error={error}
        isEmpty={!loading && !error && !metrics}
        emptyTitle="No storage metrics available"
        emptyMessage="Unable to retrieve IPFS storage telemetry from the backend."
        onRetry={refetch}
        skeletonRows={3}
      >
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card padding="lg" className="bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-[#DDE5DA] pb-3">
                <h3 className="text-base font-bold text-[#26352A] flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#47634C]" /> IPFS Storage Cluster
                </h3>
                <Badge variant="success">● {metrics.hashAnchoringStatus || 'Operational'}</Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between p-2.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
                  <span className="text-[#66736A]">Encrypted Records Payload:</span>
                  <strong className="text-[#26352A]">
                    {(metrics.encryptedRecordsCount ?? 0).toLocaleString()} Files
                  </strong>
                </div>
                <div className="flex justify-between p-2.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
                  <span className="text-[#66736A]">Stored Files Count:</span>
                  <strong className="text-[#26352A]">
                    {(metrics.storedFilesCount ?? 0).toLocaleString()} Files
                  </strong>
                </div>
                <div className="flex justify-between p-2.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
                  <span className="text-[#66736A]">Total Storage Used:</span>
                  <strong className="text-[#26352A]">
                    {metrics.totalStorageUsed || '0 MB'}
                  </strong>
                </div>
                <div className="flex justify-between p-2.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
                  <span className="text-[#66736A]">Hash Anchoring Status:</span>
                  <strong className="text-[#5F8D65]">{metrics.hashAnchoringStatus || '—'} ✓</strong>
                </div>
                <div className="flex justify-between p-2.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
                  <span className="text-[#66736A]">Storage Health:</span>
                  <strong className="text-[#5F8D65]">{metrics.storageHealthPercentage ?? 0}% Operational</strong>
                </div>
              </div>
            </Card>

            <Card padding="lg" className="bg-white space-y-4">
              <h3 className="text-base font-bold text-[#26352A]">Replication &amp; Off-Chain Decoupling</h3>
              <p className="text-xs text-[#66736A] leading-relaxed p-4 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
                In strict compliance with Medrynx architecture, confidential medical records are never uploaded unencrypted or stored directly inside smart contract state variables. All payloads reside in off-chain IPFS nodes.
              </p>
            </Card>
          </div>
        )}
      </ApiStateWrapper>
    </div>
  );
};
