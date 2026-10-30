import React from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { Users, Stethoscope, UserCheck, ShieldAlert, Cpu, Database, RefreshCw } from 'lucide-react';
import { adminService } from '../../services/admin.service';
import { aimlService } from '../../services/aiml.service';
import { useApiCall } from '../../hooks/useApiCall';
import { PlatformStats, BlockchainMetrics, StorageMetrics } from '../../types/admin';
import { AIMLSummaryMetrics } from '../../services/aiml.service';

export const AdminDashboard: React.FC = () => {
  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useApiCall<PlatformStats | null>(() => adminService.getPlatformStats(), null);

  const {
    data: blockchain,
    loading: blockchainLoading,
    error: blockchainError,
    refetch: refetchBlockchain,
  } = useApiCall<BlockchainMetrics | null>(() => adminService.getBlockchainMetrics(), null);

  const {
    data: storage,
    loading: storageLoading,
    error: storageError,
    refetch: refetchStorage,
  } = useApiCall<StorageMetrics | null>(() => adminService.getStorageMetrics(), null);

  const {
    data: aiSummary,
    loading: aiLoading,
  } = useApiCall<AIMLSummaryMetrics | null>(() => aimlService.getSummary(), null);

  const isLoading = statsLoading || blockchainLoading || storageLoading;

  const statVal = (v: number | undefined | null) =>
    isLoading ? '…' : v !== undefined && v !== null ? v.toLocaleString() : '—';

  return (
    <div className="space-y-8 font-sans">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#DDE5DA]">
        <div>
          <h2 className="text-2xl font-extrabold text-[#26352A]">Super Admin Overview 🛡️</h2>
          <p className="text-xs text-[#66736A] mt-1">
            Platform monitoring, doctor verification queue, AI anomaly alerts, and technical status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="dark">Security &amp; Compliance</Badge>
          {!blockchainLoading && blockchain?.lastBlockNumber && (
            <Badge variant="sage">Block #{blockchain.lastBlockNumber}</Badge>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => { refetchStats(); refetchBlockchain(); refetchStorage(); }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Error */}
      {statsError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">
          Platform stats unavailable: {statsError}
        </div>
      )}

      {/* 4 Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card padding="md" className="space-y-2 bg-white">
          <div className="flex items-center justify-between text-[#66736A]">
            <span className="text-xs font-semibold">Total Users</span>
            <Users className="w-5 h-5 text-[#47634C]" />
          </div>
          <span className="text-3xl font-extrabold text-[#26352A]">
            {statVal(stats?.totalUsers)}
          </span>
        </Card>

        <Card padding="md" className="space-y-2 bg-white">
          <div className="flex items-center justify-between text-[#66736A]">
            <span className="text-xs font-semibold">Total Doctors</span>
            <Stethoscope className="w-5 h-5 text-[#47634C]" />
          </div>
          <span className="text-3xl font-extrabold text-[#26352A]">
            {statVal(stats?.totalDoctors)}
          </span>
        </Card>

        <Card padding="md" className="space-y-2 bg-white">
          <div className="flex items-center justify-between text-[#66736A]">
            <span className="text-xs font-semibold">Patients</span>
            <UserCheck className="w-5 h-5 text-[#5F8D65]" />
          </div>
          <span className="text-3xl font-extrabold text-[#26352A]">
            {statVal(stats?.patientsCount)}
          </span>
        </Card>

        <Card padding="md" className="space-y-2 bg-white">
          <div className="flex items-center justify-between text-[#66736A]">
            <span className="text-xs font-semibold">Access Requests</span>
            <ShieldAlert className="w-5 h-5 text-[#D9A441]" />
          </div>
          <span className="text-3xl font-extrabold text-[#26352A]">
            {statVal(stats?.accessRequestsCount)}
          </span>
        </Card>
      </div>

      {/* Middle Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Platform Activity */}
        <Card padding="lg" className="lg:col-span-8 bg-white space-y-6">
          <div className="flex items-center justify-between border-b border-[#DDE5DA] pb-4">
            <h3 className="text-lg font-bold text-[#26352A]">Platform Activity</h3>
            <Badge variant="sage">Live</Badge>
          </div>

          <ApiStateWrapper
            loading={isLoading || aiLoading}
            error={null}
            skeletonRows={4}
          >
            {stats ? (
              <div className="space-y-4 text-xs">
                {/* We calculate percentages dynamically from real counts */}
                {(() => {
                  const total = (stats.accessRequestsCount || 0) +
                    (stats.activeEmergenciesCount || 0) +
                    (stats.totalDisputesCount || 0) +
                    (aiSummary?.flaggedCount || 0);
                  const safeTotal = total || 1;
                  const normalPct = Math.round(((stats.accessRequestsCount || 0) / safeTotal) * 100);
                  const emgPct = Math.round(((stats.activeEmergenciesCount || 0) / safeTotal) * 100);
                  const anomalyPct = Math.round(((aiSummary?.flaggedCount || 0) / safeTotal) * 100);
                  const disputePct = Math.round(((stats.totalDisputesCount || 0) / safeTotal) * 100);

                  return (
                    <>
                      <div>
                        <div className="flex justify-between mb-1 font-semibold text-[#26352A]">
                          <span>Access Requests (Normal)</span>
                          <span>{stats.accessRequestsCount?.toLocaleString() || 0} ({normalPct}%)</span>
                        </div>
                        <div className="w-full bg-[#F2E7D5] rounded-full h-3 overflow-hidden">
                          <div className="bg-[#A8CBA0] h-3 rounded-full" style={{ width: `${Math.max(normalPct, 2)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1 font-semibold text-[#26352A]">
                          <span>Emergency Break-Glass Events</span>
                          <span>{stats.activeEmergenciesCount?.toLocaleString() || 0} ({emgPct}%)</span>
                        </div>
                        <div className="w-full bg-[#F2E7D5] rounded-full h-3 overflow-hidden">
                          <div className="bg-[#C85C5C] h-3 rounded-full" style={{ width: `${Math.max(emgPct, 1)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1 font-semibold text-[#26352A]">
                          <span>AI Flagged Anomalies</span>
                          <span>{aiSummary?.flaggedCount?.toLocaleString() || 0} ({anomalyPct}%)</span>
                        </div>
                        <div className="w-full bg-[#F2E7D5] rounded-full h-3 overflow-hidden">
                          <div className="bg-[#D9A441] h-3 rounded-full" style={{ width: `${Math.max(anomalyPct, 1)}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1 font-semibold text-[#26352A]">
                          <span>Disputes Submitted</span>
                          <span>{stats.totalDisputesCount?.toLocaleString() || 0} ({disputePct}%)</span>
                        </div>
                        <div className="w-full bg-[#F2E7D5] rounded-full h-3 overflow-hidden">
                          <div className="bg-red-400 h-3 rounded-full" style={{ width: `${Math.max(disputePct, 1)}%` }} />
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <p className="text-xs text-[#66736A]">No platform stats available.</p>
            )}
          </ApiStateWrapper>
        </Card>

        {/* Technical Widgets */}
        <div className="lg:col-span-4 space-y-6">
          {/* Blockchain */}
          <Card padding="md" className="bg-white space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DDE5DA]">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#47634C]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#47634C]">Blockchain Status</h4>
              </div>
              {!blockchainError && blockchain && (
                <Badge variant="success">● Connected</Badge>
              )}
              {blockchainError && (
                <Badge variant="danger">Unavailable</Badge>
              )}
            </div>

            <ApiStateWrapper
              loading={blockchainLoading}
              error={blockchainError}
              onRetry={refetchBlockchain}
              skeletonRows={2}
            >
              {blockchain ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#66736A]">Network:</span>
                    <strong className="text-[#26352A]">{blockchain.network || '—'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#66736A]">Smart Contract:</span>
                    <strong className="text-[#5F8D65]">
                      {blockchain.contractDeployed ? 'Deployed ✓' : 'Not Deployed'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#66736A]">Last Block:</span>
                    <code className="font-mono text-[#47634C]">
                      #{blockchain.lastBlockNumber ?? '—'}
                    </code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#66736A]">Tx Anchors:</span>
                    <strong className="text-[#26352A]">
                      {blockchain.totalTransactions?.toLocaleString() ?? '—'}
                    </strong>
                  </div>
                </div>
              ) : null}
            </ApiStateWrapper>
          </Card>

          {/* Storage */}
          <Card padding="md" className="bg-white space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#DDE5DA]">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#47634C]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#47634C]">IPFS Storage</h4>
              </div>
              {!storageError && storage && (
                <Badge variant="success">{storage.storageHealthPercentage?.toFixed(1) ?? '—'}% Health</Badge>
              )}
            </div>

            <ApiStateWrapper
              loading={storageLoading}
              error={storageError}
              onRetry={refetchStorage}
              skeletonRows={2}
            >
              {storage ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#66736A]">Encrypted Records:</span>
                    <strong>{storage.encryptedRecordsCount?.toLocaleString() ?? '—'} Files</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#66736A]">Hash Anchoring:</span>
                    <strong className="text-[#5F8D65]">{storage.hashAnchoringStatus || '—'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#66736A]">Total Storage:</span>
                    <strong>{storage.totalStorageUsed || '—'}</strong>
                  </div>
                </div>
              ) : null}
            </ApiStateWrapper>
          </Card>
        </div>
      </div>
    </div>
  );
};
