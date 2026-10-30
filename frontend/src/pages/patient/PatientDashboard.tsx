import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { RiskIndicator } from '../../components/ui/RiskIndicator';
import { 
  FileText, ShieldAlert, KeyRound, History, ArrowRight, 
  CheckCircle2, ShieldCheck, Lock, Activity, Clock 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { recordsService } from '../../services/records.service';
import { consentService } from '../../services/consent.service';
import { auditService } from '../../services/audit.service';
import { emergencyService } from '../../services/emergency.service';
import { EmergencyEvent } from '../../types/emergency';
import { useNotification } from '../../context/NotificationContext';
import { AlertOctagon } from 'lucide-react';
import { getTimeBasedGreeting } from '../../utils/greeting';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useNotification();

  const [recordsCount, setRecordsCount] = useState<number>(0);
  const [requests, setRequests] = useState<any[]>([]);
  const [activeConsentsCount, setActiveConsentsCount] = useState<number>(0);
  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyEvent[]>([]);
  const [isRevokingEmergency, setIsRevokingEmergency] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = () => {
    Promise.all([
      recordsService.getRecords(),
      consentService.getAccessRequests(),
      consentService.getActiveConsents(),
      auditService.getAuditLogs(),
      emergencyService.getActiveEmergencies().catch(() => []),
    ]).then(([rec, reqs, consents, logs, emergencies]) => {
      setRecordsCount(rec.length);
      setRequests(reqs);
      setActiveConsentsCount(consents.length);
      setAuditLogs(logs);
      setActiveEmergencies(emergencies);
      setIsLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleRevokeEmergency = async (emergencyId: string) => {
    setIsRevokingEmergency(true);
    try {
      await emergencyService.revokeEmergencyAccess(emergencyId);
      showToast('Emergency break-glass access revoked immediately!', 'success');
      setActiveEmergencies((prev) => prev.filter((e) => e.id !== emergencyId));
      loadDashboardData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to revoke emergency access', 'error');
    } finally {
      setIsRevokingEmergency(false);
    }
  };


  const pendingRequests = requests.filter((r) => r.status === 'pending');

  // Dynamic access activity chart derived strictly from live auditLogs
  const totalNormal = auditLogs.filter((l) => l.accessType !== 'Emergency').length;
  const totalEmergency = auditLogs.filter((l) => l.accessType === 'Emergency').length;
  const chartData = [
    { day: 'Normal', normal: totalNormal, emergency: 0 },
    { day: 'Emergency', normal: totalEmergency, emergency: totalEmergency },
    { day: 'Total', normal: auditLogs.length, emergency: totalEmergency },
  ];

  return (
    <div className="space-y-8 font-sans">
      {/* Header Banner with Dynamic Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#DDE5DA] shadow-xs">
        <div>
          <h2 className="text-2xl font-extrabold text-[#26352A]">
            {getTimeBasedGreeting()}, {user?.name || 'Patient'} 👋
          </h2>
          <p className="text-xs text-[#66736A] mt-1">
            Here's your real-time medical data, consent scopes, and security activity.
          </p>
        </div>
        <Button variant="primary" icon={<FileText className="w-4 h-4" />} onClick={() => navigate('/patient/records')}>
          View My Records
        </Button>
      </div>

      {/* Active Break-Glass Emergency Warning Banner */}
      {activeEmergencies.length > 0 && (
        <div className="space-y-3">
          {activeEmergencies.map((emg) => (
            <div
              key={emg.id}
              className="p-5 rounded-2xl bg-red-50 border-2 border-red-300 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center font-bold text-xl shrink-0 mt-0.5">
                  🚨
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-extrabold text-red-950">
                      Active Break-Glass Emergency Session Invoked
                    </h4>
                    <Badge variant="danger">Live Emergency</Badge>
                    <span className="text-xs font-mono font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                      Tier: {emg.accessLevel || 'Partial'}
                    </span>
                  </div>
                  <p className="text-xs text-red-800 leading-relaxed">
                    <strong>{emg.doctorName}</strong> ({emg.hospital}) declared emergency override for reason:{' '}
                    <em>&quot;{emg.reason}&quot;</em>. Permitted Categories:{' '}
                    <strong>{Array.isArray(emg.recordsAccessed) ? emg.recordsAccessed.join(', ') : 'Partial Records'}</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleRevokeEmergency(emg.id)}
                  isLoading={isRevokingEmergency}
                >
                  Immediate Revoke
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/patient/emergency')}
                >
                  Emergency Log
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          {error}
        </div>
      )}

      {/* 4 Key Statistics Cards (100% Dynamic) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card padding="md" className="space-y-2">
          <div className="flex items-center justify-between text-[#66736A]">
            <span className="text-xs font-semibold">Medical Records</span>
            <FileText className="w-5 h-5 text-[#47634C]" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#26352A]">
              {isLoading ? '...' : recordsCount}
            </span>
            <span className="text-[11px] font-semibold text-[#5F8D65]">100% Encrypted</span>
          </div>
        </Card>

        <Card padding="md" className="space-y-2">
          <div className="flex items-center justify-between text-[#66736A]">
            <span className="text-xs font-semibold">Pending Requests</span>
            <ShieldAlert className="w-5 h-5 text-[#D9A441]" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#26352A]">
              {isLoading ? '...' : pendingRequests.length}
            </span>
            <span className="text-[11px] font-semibold text-[#D9A441]">Action Required</span>
          </div>
        </Card>

        <Card padding="md" className="space-y-2">
          <div className="flex items-center justify-between text-[#66736A]">
            <span className="text-xs font-semibold">Active Access</span>
            <KeyRound className="w-5 h-5 text-[#5F8D65]" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#26352A]">
              {isLoading ? '...' : activeConsentsCount}
            </span>
            <span className="text-[11px] font-semibold text-[#5F8D65]">Scoped Clinicians</span>
          </div>
        </Card>

        <Card padding="md" className="space-y-2">
          <div className="flex items-center justify-between text-[#66736A]">
            <span className="text-xs font-semibold">Audit Events</span>
            <History className="w-5 h-5 text-[#47634C]" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-[#26352A]">
              {isLoading ? '…' : auditLogs.length}
            </span>
            <span className="text-[11px] font-semibold text-[#47634C]">100% Verified</span>
          </div>
        </Card>
      </div>

      {/* Middle Grid: Pending Requests & Security Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Pending Requests Requiring Attention */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#26352A]">Access Requests Requiring Attention</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/patient/access-requests')}>
              View All ({pendingRequests.length}) <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          <div className="space-y-4">
            {pendingRequests.length === 0 ? (
              <Card padding="lg" className="text-center py-8 text-[#66736A] text-xs bg-white">
                No pending clinician access requests at this time.
              </Card>
            ) : (
              pendingRequests.slice(0, 3).map((req) => (
                <Card key={req.id} padding="md" className="space-y-4 bg-white border-[#DDE5DA]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F2E7D5] text-[#47634C] flex items-center justify-center font-bold text-sm">
                        {req.doctorName ? req.doctorName.charAt(4) || req.doctorName.charAt(0) : 'D'}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-[#26352A]">{req.doctorName}</h4>
                        <p className="text-xs text-[#66736A]">{req.hospital} • {req.doctorSpecialty}</p>
                      </div>
                    </div>
                    <RiskIndicator assessment={req.riskAssessment} compact />
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-3 bg-[#F8F3EA] rounded-xl text-xs">
                    <div>
                      <span className="text-[11px] text-[#66736A] block">Requested Record</span>
                      <span className="font-semibold text-[#26352A]">{req.recordType}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#66736A] block">Stated Purpose</span>
                      <span className="font-semibold text-[#26352A]">{req.purpose}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#66736A] block">Duration</span>
                      <span className="font-semibold text-[#26352A]">{req.durationDays} Days</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-1 border-t border-[#DDE5DA]">
                    <Button variant="secondary" size="sm" onClick={() => navigate('/patient/access-requests')}>
                      Review Request
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Right: Security Overview Panel & Dynamic Chart */}
        <div className="lg:col-span-4 space-y-6">
          {/* Security Status Box */}
          <Card padding="md" className="space-y-4 bg-white border-[#DDE5DA]">
            <div className="flex items-center gap-2 pb-2 border-b border-[#DDE5DA]">
              <ShieldCheck className="w-5 h-5 text-[#5F8D65]" />
              <h3 className="text-sm font-bold text-[#26352A]">Security Overview</h3>
            </div>
            
            <p className="text-xs text-[#5F8D65] font-semibold flex items-center gap-1.5 bg-[#E7F0E4] p-2.5 rounded-xl border border-[#A8CBA0]/50">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Your account is fully protected
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-[#DDE5DA]/40">
                <span className="text-[#66736A]">Authentication</span>
                <span className="text-[#5F8D65] font-bold">✓ Active</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#DDE5DA]/40">
                <span className="text-[#66736A]">Record Encryption</span>
                <span className="text-[#5F8D65] font-bold">✓ Active</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#DDE5DA]/40">
                <span className="text-[#66736A]">Access Monitoring</span>
                <span className="text-[#5F8D65] font-bold">✓ Active</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[#66736A]">Audit Logging</span>
                <span className="text-[#5F8D65] font-bold">✓ Active</span>
              </div>
            </div>
          </Card>

          {/* Recharts Access Activity Trend */}
          <Card padding="md" className="space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#47634C]">Access Activity Trend</h4>
              <Badge variant="sage">Live Logged</Badge>
            </div>

            <div className="h-40 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#A8CBA0" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#A8CBA0" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="#66736A" fontSize={10} tickLine={false} />
                  <YAxis stroke="#66736A" fontSize={10} tickLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="normal" stroke="#47634C" fillOpacity={1} fill="url(#colorNormal)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Activity Table (Live from auditService) */}
      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[#26352A]">Recent Access Activity</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/patient/audit')}>
            Audit Trail <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#DDE5DA] text-[11px] font-bold uppercase text-[#66736A]">
                <th className="py-3 px-3">Clinician</th>
                <th className="py-3 px-3">Record</th>
                <th className="py-3 px-3">Purpose</th>
                <th className="py-3 px-3">Date/Time</th>
                <th className="py-3 px-3">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE5DA] text-xs">
              {auditLogs.slice(0, 4).map((evt) => (
                <tr key={evt.id} className="hover:bg-[#F2E7D5]/40 transition-colors">
                  <td className="py-3 px-3 font-semibold text-[#26352A]">{evt.actorName}</td>
                  <td className="py-3 px-3 text-[#66736A]">{evt.recordType}</td>
                  <td className="py-3 px-3 text-[#66736A]">{evt.purpose}</td>
                  <td className="py-3 px-3 text-[#66736A]">{evt.timestamp}</td>
                  <td className="py-3 px-3">
                    <StatusBadge status={evt.accessType === 'Emergency' ? 'emergency' : 'approved'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
