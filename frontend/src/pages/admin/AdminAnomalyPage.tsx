import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
  AlertTriangle,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  aimlService,
  AIMLHealthStatus,
  AIMLModelInfo,
  AIMLAnomalyItem,
} from '../../services/aiml.service';

export const AdminAnomalyPage: React.FC = () => {
  const [anomalies, setAnomalies] = useState<AIMLAnomalyItem[]>([]);
  const [modelHealth, setModelHealth] = useState<AIMLHealthStatus | null>(null);
  const [modelInfo, setModelInfo] = useState<AIMLModelInfo | null>(null);
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [healthData, infoData, anomalyList] = await Promise.all([
        aimlService.getHealth().catch(() => ({
          status: 'unavailable' as const,
          modelLoaded: false,
          detail: 'Microservice disconnected',
        })),
        aimlService.getModelInfo().catch(() => null),
        aimlService.getAnomalies().catch(() => []),
      ]);

      setModelHealth(healthData);
      setModelInfo(infoData);
      setAnomalies(anomalyList);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const highRisk = anomalies.filter(
    (a) => a.riskLevel.toUpperCase() === 'HIGH' || a.anomalyScore >= 65
  ).length;
  const modRisk = anomalies.filter(
    (a) =>
      a.riskLevel.toUpperCase() === 'MODERATE' ||
      (a.anomalyScore >= 40 && a.anomalyScore < 65)
  ).length;
  const lowRisk = anomalies.filter(
    (a) =>
      a.riskLevel.toUpperCase() === 'LOW' && a.anomalyScore < 40
  ).length;
  const flaggedCount = anomalies.filter((a) => a.isFlagged).length;

  const filteredAnomalies = anomalies.filter((item) => {
    if (selectedRiskFilter === 'HIGH') {
      return item.riskLevel.toUpperCase() === 'HIGH' || item.anomalyScore >= 65;
    }
    if (selectedRiskFilter === 'MODERATE') {
      return (
        item.riskLevel.toUpperCase() === 'MODERATE' ||
        (item.anomalyScore >= 40 && item.anomalyScore < 65)
      );
    }
    if (selectedRiskFilter === 'LOW') {
      return item.riskLevel.toUpperCase() === 'LOW' && item.anomalyScore < 40;
    }
    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header with Title and Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#26352A]">AI Anomaly Monitoring</h2>
          <p className="text-xs text-[#66736A] mt-0.5">
            Operational access pattern analysis using Scikit-Learn IsolationForest model.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs text-[#26352A] border-[#DDE5DA]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* Model Telemetry Banner */}
      <Card padding="md" className="bg-[#FAFDF9] border-[#DDE5DA]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#E7F0E4] rounded-xl text-[#3A6B43]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[#26352A]">
                  {modelInfo?.algorithm || 'Isolation Forest Anomaly Detector'}
                </h4>
                <Badge
                  variant={
                    modelHealth?.status === 'ok'
                      ? 'success'
                      : modelHealth?.status === 'degraded'
                      ? 'warning'
                      : 'danger'
                  }
                >
                  {modelHealth?.status === 'ok' ? 'LIVE ONLINE' : modelHealth?.status?.toUpperCase() || 'OFFLINE'}
                </Badge>
              </div>
              <p className="text-xs text-[#66736A] mt-0.5">
                Version: <span className="font-semibold text-[#26352A]">{modelHealth?.modelVersion || modelInfo?.version || '1.0'}</span> | Features:{' '}
                <span className="font-semibold text-[#26352A]">{modelInfo?.features?.length || 10} operational vectors</span> | Zero-PHI Guaranteed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="bg-white px-3 py-2 rounded-lg border border-[#DDE5DA]">
              <span className="text-[#66736A] block">Thresholds:</span>
              <span className="font-bold text-[#26352A]">Mod: 45 / High: 65</span>
            </div>
            <div className="bg-white px-3 py-2 rounded-lg border border-[#DDE5DA]">
              <span className="text-[#66736A] block">Fail-Safe State:</span>
              <span className="font-bold text-[#3A6B43]">Fail-Open Safe</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Strict Advisory Disclaimer Alert */}
      <div className="flex items-start gap-2.5 p-3.5 bg-[#EFF5EC] rounded-xl border border-[#A8CBA0]/50 text-xs text-[#26352A]">
        <Info className="w-4 h-4 text-[#3A6B43] mt-0.5 shrink-0" />
        <div>
          <strong className="font-bold text-[#26352A]">Decision-Support Guardrail:</strong> AI/ML signals are strictly advisory.
          The anomaly detection engine cannot grant or revoke access, override patient consent, alter ABAC/RBAC policies, or trigger KMS decryption.
        </div>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          onClick={() => setSelectedRiskFilter('HIGH')}
          className={`text-left rounded-2xl transition-all ${
            selectedRiskFilter === 'HIGH' ? 'ring-2 ring-[#C85C5C]' : ''
          }`}
        >
          <Card padding="md" className="bg-[#fceded] border-[#f8c4c4] h-full">
            <span className="text-xs font-semibold text-[#C85C5C]">High Risk (65+)</span>
            <h4 className="text-2xl font-extrabold text-[#C85C5C] mt-1">{isLoading ? '...' : highRisk}</h4>
            <span className="text-[10px] text-[#C85C5C]/80 mt-1 block">Requires scrutiny</span>
          </Card>
        </button>

        <button
          onClick={() => setSelectedRiskFilter('MODERATE')}
          className={`text-left rounded-2xl transition-all ${
            selectedRiskFilter === 'MODERATE' ? 'ring-2 ring-[#D9A441]' : ''
          }`}
        >
          <Card padding="md" className="bg-[#fcf5e5] border-[#D9A441] h-full">
            <span className="text-xs font-semibold text-[#D9A441]">Moderate (45-64)</span>
            <h4 className="text-2xl font-extrabold text-[#D9A441] mt-1">{isLoading ? '...' : modRisk}</h4>
            <span className="text-[10px] text-[#D9A441]/80 mt-1 block">Minor deviation</span>
          </Card>
        </button>

        <button
          onClick={() => setSelectedRiskFilter('LOW')}
          className={`text-left rounded-2xl transition-all ${
            selectedRiskFilter === 'LOW' ? 'ring-2 ring-[#5F8D65]' : ''
          }`}
        >
          <Card padding="md" className="bg-[#E7F0E4] border-[#A8CBA0] h-full">
            <span className="text-xs font-semibold text-[#47634C]">Low Risk (&lt;45)</span>
            <h4 className="text-2xl font-extrabold text-[#5F8D65] mt-1">{isLoading ? '...' : lowRisk}</h4>
            <span className="text-[10px] text-[#5F8D65]/80 mt-1 block">Normative scope</span>
          </Card>
        </button>

        <button
          onClick={() => setSelectedRiskFilter('ALL')}
          className={`text-left rounded-2xl transition-all ${
            selectedRiskFilter === 'ALL' ? 'ring-2 ring-[#26352A]' : ''
          }`}
        >
          <Card padding="md" className="bg-[#F8F3EA] border-[#DDE5DA] h-full">
            <span className="text-xs font-semibold text-[#26352A]">Flagged for Review</span>
            <h4 className="text-2xl font-extrabold text-[#26352A] mt-1">{isLoading ? '...' : flaggedCount}</h4>
            <span className="text-[10px] text-[#66736A] mt-1 block">
              Total Evaluated: {isLoading ? '...' : anomalies.length}
            </span>
          </Card>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#DDE5DA] pb-2 text-xs">
        <span className="text-[#66736A] mr-2">Filter View:</span>
        {['ALL', 'HIGH', 'MODERATE', 'LOW'].map((filterKey) => (
          <button
            key={filterKey}
            onClick={() => setSelectedRiskFilter(filterKey)}
            className={`px-3 py-1 rounded-full font-medium transition-colors ${
              selectedRiskFilter === filterKey
                ? 'bg-[#26352A] text-white'
                : 'text-[#66736A] hover:bg-[#E7F0E4] hover:text-[#26352A]'
            }`}
          >
            {filterKey}
          </button>
        ))}
      </div>

      {/* Dynamic Anomaly Alerts List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-10 text-[#66736A] text-xs">
            Loading evaluated access patterns from AI/ML advisory engine...
          </div>
        ) : filteredAnomalies.length === 0 ? (
          <Card padding="lg" className="text-center py-10 bg-white">
            <ShieldCheck className="w-8 h-8 text-[#5F8D65] mx-auto mb-2" />
            <p className="text-sm font-bold text-[#26352A]">No Access Patterns Found</p>
            <p className="text-xs text-[#66736A] mt-1">
              {selectedRiskFilter === 'ALL'
                ? 'All incoming clinician access requests fall within normative operational scopes.'
                : `No access patterns found matching '${selectedRiskFilter}' risk level.`}
            </p>
          </Card>
        ) : (
          filteredAnomalies.map((item) => {
            const isHigh = item.anomalyScore >= 65 || item.riskLevel.toString().toUpperCase() === 'HIGH';
            const isMod =
              !isHigh &&
              (item.anomalyScore >= 45 || item.riskLevel.toString().toUpperCase() === 'MODERATE');

            return (
              <Card
                key={item.id}
                padding="lg"
                className={`bg-white space-y-4 border ${
                  isHigh ? 'border-[#C85C5C]' : isMod ? 'border-[#D9A441]' : 'border-[#A8CBA0]'
                }`}
              >
                <div className="flex items-center justify-between border-b border-[#DDE5DA] pb-3">
                  <div className="flex items-center gap-2">
                    {isHigh ? (
                      <AlertTriangle className="w-5 h-5 text-[#C85C5C]" />
                    ) : isMod ? (
                      <AlertCircle className="w-5 h-5 text-[#D9A441]" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-[#5F8D65]" />
                    )}
                    <h3 className="text-base font-bold text-[#26352A]">
                      {isHigh
                        ? 'High Anomaly Risk Signal'
                        : isMod
                        ? 'Moderate Anomaly Signal'
                        : 'Standard Normative Pattern'}
                    </h3>
                  </div>
                  <Badge variant={isHigh ? 'danger' : isMod ? 'warning' : 'success'}>
                    Risk Score: {item.anomalyScore} / 100
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs p-3.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA]">
                  <div>
                    <span className="text-[#66736A] block">Requesting Doctor:</span>
                    <strong className="text-[#26352A] text-sm">{item.doctorName}</strong>
                    <span className="text-[#66736A] block">
                      {item.hospital} ({item.doctorSpecialty})
                    </span>
                  </div>
                  <div>
                    <span className="text-[#66736A] block">Target Patient & Record:</span>
                    <strong className="text-[#26352A]">{item.recordType}</strong>
                    <span className="text-[#66736A] block">Patient ID: {item.patientId}</span>
                  </div>
                  <div>
                    <span className="text-[#66736A] block">Access Status & Purpose:</span>
                    <span className="font-bold text-[#26352A] capitalize">{item.purpose}</span>
                    <span className="text-[#66736A] block mt-0.5">
                      Status:{' '}
                      <span className="font-semibold text-[#3A6B43] uppercase">{item.status}</span>
                    </span>
                  </div>
                </div>

                {item.reasons && item.reasons.length > 0 && (
                  <div className="p-3 bg-[#fcf5e5] rounded-xl border border-[#D9A441]/40 text-xs text-[#26352A]">
                    💡 <strong>AI/ML Risk Indicators:</strong> {item.reasons.join('. ')}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
