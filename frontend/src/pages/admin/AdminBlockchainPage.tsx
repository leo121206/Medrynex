import React from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { Cpu, ShieldCheck } from 'lucide-react';
import { adminService } from '../../services/admin.service';
import { useApiCall } from '../../hooks/useApiCall';
import { BlockchainMetrics } from '../../types/admin';

export const AdminBlockchainPage: React.FC = () => {
  const { data: metrics, loading, error, refetch } = useApiCall<BlockchainMetrics | null>(
    () => adminService.getBlockchainMetrics(),
    null
  );

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">Blockchain Technical Status</h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          Real-time node connectivity, smart contract deployment, and block verification.
        </p>
      </div>

      <ApiStateWrapper
        loading={loading}
        error={error}
        isEmpty={!loading && !error && !metrics}
        emptyTitle="No blockchain metrics available"
        emptyMessage="Unable to retrieve telemetry from the configured blockchain node."
        onRetry={refetch}
        skeletonRows={3}
      >
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card padding="lg" className="bg-white space-y-4">
              <div className="flex items-center justify-between border-b border-[#DDE5DA] pb-3">
                <h3 className="text-base font-bold text-[#26352A] flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-[#47634C]" /> Node Connection Metrics
                </h3>
                <Badge variant={metrics.status === 'Connected' ? 'success' : 'warning'}>
                  ● {metrics.status || 'Unknown'}
                </Badge>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between p-2.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
                  <span className="text-[#66736A]">Target Network:</span>
                  <strong className="text-[#26352A]">{metrics.network || '—'}</strong>
                </div>
                <div className="flex justify-between p-2.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
                  <span className="text-[#66736A]">Smart Contract:</span>
                  <strong className={metrics.contractDeployed ? 'text-[#5F8D65]' : 'text-[#C85C5C]'}>
                    {metrics.contractDeployed ? 'Deployed & Active ✓' : 'Not Deployed'}
                  </strong>
                </div>
                <div className="flex justify-between p-2.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
                  <span className="text-[#66736A]">Total Anchored Transactions:</span>
                  <strong className="text-[#26352A]">
                    {(metrics.totalTransactions ?? 0).toLocaleString()} Transactions
                  </strong>
                </div>
                <div className="flex justify-between p-2.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
                  <span className="text-[#66736A]">Total Ledger Events Emitted:</span>
                  <strong className="text-[#26352A]">
                    {(metrics.totalEvents ?? 0).toLocaleString()} Events
                  </strong>
                </div>
                <div className="flex justify-between p-2.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
                  <span className="text-[#66736A]">Latest Block Height:</span>
                  <code className="text-[#47634C] font-mono font-bold">
                    #{metrics.lastBlockNumber ?? 0}
                  </code>
                </div>
              </div>
            </Card>

            <Card padding="lg" className="bg-white space-y-4">
              <h3 className="text-base font-bold text-[#26352A]">Integrity Verification Rate</h3>
              <div className="p-6 bg-[#E7F0E4] rounded-2xl border border-[#A8CBA0] text-center space-y-2">
                <ShieldCheck className="w-12 h-12 text-[#5F8D65] mx-auto" />
                <h4 className="text-3xl font-extrabold text-[#26352A]">
                  {metrics.integrityVerificationRate || '—'}
                </h4>
                <p className="text-xs text-[#47634C] font-semibold">
                  On-chain smart contract hash anchor verification status.
                </p>
              </div>
            </Card>
          </div>
        )}
      </ApiStateWrapper>
    </div>
  );
};
