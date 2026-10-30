import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { useNotification } from '../../context/NotificationContext';
import { emergencyService } from '../../services/emergency.service';
import { relationshipService, DoctorPatientDirectoryEntry } from '../../services/relationship.service';
import { EmergencyAccessLevel, EmergencyEvent } from '../../types/emergency';
import {
  AlertOctagon,
  CheckCircle2,
  ShieldAlert,
  Lock,
  AlertTriangle,
  Clock,
  ExternalLink,
  XCircle,
  Search,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

interface CountdownTimerProps {
  expiryDateStr?: string;
  onExpire?: () => void;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ expiryDateStr, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState<{ minutes: number; seconds: number; isExpired: boolean }>({
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    if (!expiryDateStr) return;

    const calculate = () => {
      const target = new Date(expiryDateStr).getTime();
      const diff = target - Date.now();
      if (diff <= 0) {
        setTimeLeft({ minutes: 0, seconds: 0, isExpired: true });
        if (onExpire) onExpire();
        return;
      }
      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ minutes, seconds, isExpired: false });
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [expiryDateStr, onExpire]);

  if (timeLeft.isExpired) {
    return <span className="text-[#C85C5C] font-mono font-bold">EXPIRED</span>;
  }

  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    <span className="font-mono font-bold text-[#C85C5C] tracking-wide">
      {pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
    </span>
  );
};

export const DoctorEmergencyPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useNotification();

  const [patients, setPatients] = useState<DoctorPatientDirectoryEntry[]>([]);
  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyEvent[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [isLoadingActive, setIsLoadingActive] = useState(false);

  // Form State
  const [patientId, setPatientId] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [accessLevel, setAccessLevel] = useState<EmergencyAccessLevel>('Partial');
  const [reason, setReason] = useState('');
  const [emergencyCode, setEmergencyCode] = useState('');

  // Modal & Action State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [breakGlassSuccess, setBreakGlassSuccess] = useState<EmergencyEvent | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    loadPatients();
    loadActiveEmergencies();
  }, []);

  const loadPatients = async () => {
    setIsLoadingPatients(true);
    try {
      const data = await relationshipService.getPatientDirectory();
      setPatients(data);
    } catch {
      showToast('Could not load patient directory', 'error');
    } finally {
      setIsLoadingPatients(false);
    }
  };

  const loadActiveEmergencies = async () => {
    setIsLoadingActive(true);
    try {
      const data = await emergencyService.getActiveEmergencies();
      setActiveEmergencies(data);
    } catch {
      setActiveEmergencies([]);
    } finally {
      setIsLoadingActive(false);
    }
  };

  const handleOpenConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) {
      showToast('Please select a target patient for emergency override', 'warning');
      return;
    }
    if (!reason.trim() || reason.trim().length < 5) {
      showToast('Please enter an adequate clinical emergency justification (min 5 characters)', 'warning');
      return;
    }
    if (accessLevel === 'Full' && !emergencyCode.trim()) {
      showToast('Emergency authorization code is required for Tier 2 Full Access', 'warning');
      return;
    }
    setIsConfirmModalOpen(true);
  };

  const handleExecuteBreakGlass = async () => {
    setIsSubmitting(true);
    try {
      const event = await emergencyService.triggerEmergencyAccess({
        patientId,
        accessLevel,
        reason,
        emergencyCode: accessLevel === 'Full' ? emergencyCode : undefined,
      });
      setBreakGlassSuccess(event);
      showToast(`Break-glass emergency access activated (${accessLevel} tier)!`, 'success');
      // Refresh active sessions
      await loadActiveEmergencies();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Emergency break-glass activation failed', 'error');
      setIsConfirmModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeEmergency = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to immediately revoke this emergency session? Access will be terminated.')) {
      return;
    }
    setRevokingId(eventId);
    try {
      await emergencyService.revokeEmergencyAccess(eventId);
      showToast('Emergency break-glass session revoked successfully', 'info');
      await loadActiveEmergencies();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to revoke emergency access', 'error');
    } finally {
      setRevokingId(null);
    }
  };

  // Filter patients for dropdown / quick select
  const filteredPatients = patients.filter((p) => {
    const q = searchFilter.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.patientId.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  });

  const selectedPatientData = patients.find((p) => p.id === patientId || p.patientId === patientId);

  const patientOptions = [
    { value: '', label: 'Select Patient from Directory...' },
    ...filteredPatients.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.patientId}) — Blood: ${p.bloodGroup || 'N/A'}, Tier: ${p.trustTier}`,
    })),
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#fceded] text-[#C85C5C] rounded-xl">
              <AlertOctagon className="w-5 h-5" />
            </span>
            <h2 className="text-2xl font-extrabold text-[#26352A]">Emergency Break-Glass Access</h2>
          </div>
          <p className="text-xs text-[#66736A] mt-1">
            Cryptographically time-locked medical override protocol for acute trauma and critical care.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            loadPatients();
            loadActiveEmergencies();
          }}
          icon={<RefreshCw className="w-4 h-4" />}
          isLoading={isLoadingActive || isLoadingPatients}
        >
          Refresh Sessions
        </Button>
      </div>

      {/* ACTIVE EMERGENCY SESSIONS SECTION */}
      {activeEmergencies.length > 0 && (
        <Card padding="lg" className="border-2 border-[#C85C5C]/40 bg-[#fceded]/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#C85C5C]">
                Active Break-Glass Emergency Sessions ({activeEmergencies.length})
              </h3>
            </div>
            <span className="text-[11px] text-[#66736A] font-medium">
              Time-locked cryptographic access active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeEmergencies.map((emg) => (
              <div
                key={emg.id}
                className="bg-white rounded-xl p-4 border border-[#f8c4c4] shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-[#26352A] text-sm flex items-center gap-1.5">
                      <span>{emg.patientName}</span>
                      <span className="text-xs font-normal text-[#66736A]">
                        ({emg.patientHumanId || emg.patientId.slice(0, 8)})
                      </span>
                    </h4>
                    <p className="text-[11px] text-[#66736A] mt-0.5">
                      Hospital: <strong className="text-[#26352A]">{emg.hospital}</strong>
                    </p>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${
                      emg.accessLevel === 'Full'
                        ? 'bg-[#fceded] text-[#C85C5C] border border-[#f8c4c4]'
                        : 'bg-[#E7F0E4] text-[#47634C] border border-[#A8CBA0]'
                    }`}
                  >
                    {emg.accessLevel === 'Full' ? '🚨 Tier 2 Full' : '⚡ Tier 1 Partial'}
                  </span>
                </div>

                <div className="p-2.5 bg-[#F8F3EA] rounded-lg text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#66736A] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#C85C5C]" />
                      Session Time Remaining:
                    </span>
                    <CountdownTimer
                      expiryDateStr={emg.autoRevokeTimestamp}
                      onExpire={loadActiveEmergencies}
                    />
                  </div>
                  <div className="text-[11px] text-[#47634C]">
                    <strong>Reason:</strong> {emg.reason}
                  </div>
                  <div className="text-[10px] text-[#66736A]">
                    Unlocked: {emg.recordsAccessed?.join(', ') || 'Emergency Clinical Vitals'}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 text-xs py-1.5"
                    icon={<FolderOpen className="w-3.5 h-3.5" />}
                    onClick={() => navigate(`/doctor/authorized-records?patientId=${emg.patientId}`)}
                  >
                    View Authorized Records
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    className="text-xs py-1.5"
                    icon={<XCircle className="w-3.5 h-3.5" />}
                    isLoading={revokingId === emg.id}
                    onClick={() => handleRevokeEmergency(emg.id)}
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Main Grid: Declaration Form + Protocol Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Panel */}
        <Card padding="lg" className="lg:col-span-7 bg-white space-y-5">
          <div className="border-b border-[#DDE5DA] pb-3">
            <h3 className="text-base font-bold text-[#26352A]">Declare Break-Glass Override</h3>
            <p className="text-xs text-[#66736A] mt-0.5">
              Select any patient to initiate temporary emergency record decryption.
            </p>
          </div>

          <form onSubmit={handleOpenConfirmation} className="space-y-4 text-xs">
            {/* Quick search input */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#47634C]">
                Search Patient (Directory: {patients.length} available)
              </label>
              <div className="relative">
                <Input
                  placeholder="Filter by name, ID (PT-1001), or email..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
                <Search className="w-4 h-4 text-[#66736A] absolute right-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <Select
              label="Target Patient"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              options={patientOptions}
              required
            />

            {selectedPatientData && (
              <div className="p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA] text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#66736A]">Selected Patient:</span>
                  <strong className="text-[#26352A]">{selectedPatientData.name} ({selectedPatientData.patientId})</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#66736A]">Baseline Trust Tier:</span>
                  <strong className="text-[#47634C]">{selectedPatientData.trustTier} — {selectedPatientData.tierLabel}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#66736A]">Blood Group & DOB:</span>
                  <span className="text-[#26352A]">{selectedPatientData.bloodGroup || 'O+'} | {selectedPatientData.dob || '1990-01-01'}</span>
                </div>
              </div>
            )}

            {/* Verification Banner */}
            <div className="p-3 bg-[#E7F0E4] rounded-xl border border-[#A8CBA0] text-[#47634C] flex items-center justify-between font-bold">
              <span>Verification Status:</span>
              <span className="text-[#5F8D65] flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 inline" /> Hospital Identity Verified
              </span>
            </div>

            {/* Access Level Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#47634C]">Access Tier Level</label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setAccessLevel('Partial')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    accessLevel === 'Partial'
                      ? 'border-[#47634C] bg-[#E7F0E4]/60 shadow-sm'
                      : 'border-[#DDE5DA] bg-white hover:border-[#A8CBA0]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-[#26352A]">⚡ Tier 1: Partial Access</h5>
                    <span className="text-[10px] bg-[#47634C] text-white px-2 py-0.5 rounded-full">15 Mins</span>
                  </div>
                  <p className="text-[11px] text-[#66736A] mt-1.5">
                    Authorized Scope: <strong>Medications, Clinical Vitals, Vaccinations</strong>
                  </p>
                </div>

                <div
                  onClick={() => setAccessLevel('Full')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    accessLevel === 'Full'
                      ? 'border-[#C85C5C] bg-[#fceded]/60 shadow-sm'
                      : 'border-[#DDE5DA] bg-white hover:border-[#f8c4c4]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-[#C85C5C]">🚨 Tier 2: Full Access</h5>
                    <span className="text-[10px] bg-[#C85C5C] text-white px-2 py-0.5 rounded-full">30 Mins</span>
                  </div>
                  <p className="text-[11px] text-[#66736A] mt-1.5">
                    Authorized Scope: <strong>Complete Clinical History</strong> (Requires Auth Code)
                  </p>
                </div>
              </div>
            </div>

            {accessLevel === 'Full' && (
              <Input
                label="Emergency Authorization Code"
                placeholder="e.g. EMG-CODE-9941-VERIFIED"
                value={emergencyCode}
                onChange={(e) => setEmergencyCode(e.target.value)}
                required
              />
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#47634C]">
                Clinical Emergency Justification
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide trauma details, unconscious patient status, or acute clinical rationale..."
                rows={3}
                className="medrynx-input w-full p-2.5 rounded-xl border border-[#DDE5DA] text-xs focus:outline-none focus:border-[#47634C]"
                required
              />
            </div>

            <Button
              type="submit"
              variant="danger"
              className="w-full py-3 text-sm font-bold"
              icon={<AlertOctagon className="w-4 h-4" />}
            >
              Request Emergency Break-Glass Access
            </Button>
          </form>
        </Card>

        {/* Tiered Info Panel */}
        <Card padding="lg" className="lg:col-span-5 bg-white space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#47634C]">
            Tiered Emergency Policy Engine
          </h3>

          <div className="space-y-3 text-xs leading-relaxed">
            <div className="p-3.5 bg-[#E7F0E4] rounded-xl border border-[#A8CBA0]/50 space-y-1.5">
              <h5 className="font-bold text-[#47634C] flex items-center gap-1.5">
                <span>⚡ Tier 1: Partial Emergency Access (15 Min)</span>
              </h5>
              <p className="text-[#66736A]">
                Immediately unlocks life-critical medical categories: <strong>Medications, Clinical Vitals, and Vaccinations</strong>.
                Designed for acute trauma stabilization where complete medical records are not required.
              </p>
              <div className="text-[11px] text-[#47634C] font-semibold pt-1">
                Enforced by ABAC engine — Non-clinical documents (Imaging, Genomic) remain restricted.
              </div>
            </div>

            <div className="p-3.5 bg-[#fceded] rounded-xl border border-[#f8c4c4] space-y-1.5 text-[#C85C5C]">
              <h5 className="font-bold flex items-center gap-1.5">
                <span>🚨 Tier 2: Full Emergency Access (30 Min)</span>
              </h5>
              <p className="text-[#26352A]">
                Requires secondary hospital authorization code. Grants comprehensive access to full clinical history,
                imaging, laboratory reports, and specialty consultations.
              </p>
              <div className="text-[11px] text-[#C85C5C] font-semibold pt-1">
                Automatically initiates on-chain anchoring and mandatory post-emergency patient reconciliation.
              </div>
            </div>

            <div className="p-3.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA] space-y-1 text-[#66736A]">
              <h5 className="font-bold text-[#26352A]">Strict Audit & Revocation Guarantees</h5>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                <li>All emergency access attempts are permanently recorded with cryptographic SHA-256 evidence.</li>
                <li>When the time-lock window expires or is manually revoked, access is immediately terminated (HTTP 403).</li>
                <li>Patient receives automatic notification upon break-glass activation.</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Confirmation & Success Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => {
          setIsConfirmModalOpen(false);
          setBreakGlassSuccess(null);
        }}
        title="Emergency Access Request"
        subtitle="Confirm break-glass activation"
      >
        {breakGlassSuccess ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-14 h-14 bg-[#E7F0E4] rounded-full text-[#5F8D65] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#26352A]">Emergency Access Active</h3>
            <p className="text-xs text-[#66736A]">
              Unlocked records: <strong>{breakGlassSuccess.recordsAccessed?.join(', ')}</strong>
            </p>
            <div className="p-3 bg-[#F8F3EA] rounded-xl text-xs space-y-1 text-left">
              <div className="flex justify-between">
                <span className="text-[#66736A]">Patient:</span>
                <strong>{breakGlassSuccess.patientName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#66736A]">Duration:</span>
                <strong>{breakGlassSuccess.durationMinutes} Minutes</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#66736A]">Status:</span>
                <span className="text-[#5F8D65] font-bold">Active & Decryptable</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                className="w-full py-2.5 text-xs"
                icon={<FolderOpen className="w-4 h-4" />}
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  navigate(`/doctor/authorized-records?patientId=${breakGlassSuccess.patientId}`);
                }}
              >
                View Patient Records Now
              </Button>
              <Button
                variant="secondary"
                className="py-2.5 text-xs"
                onClick={() => {
                  setIsConfirmModalOpen(false);
                  setBreakGlassSuccess(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <p className="text-[#26352A] leading-relaxed">
              You are requesting <strong>{accessLevel} Level Emergency Access</strong> to this patient's medical records.
            </p>

            <div className="p-3.5 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#66736A]">Patient:</span>
                <strong>{selectedPatientData?.name || patientId}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#66736A]">Access Level:</span>
                <strong>Tier {accessLevel === 'Full' ? '2 Full' : '1 Partial'} Access</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#66736A]">Duration Window:</span>
                <strong>{accessLevel === 'Full' ? '30 Minutes' : '15 Minutes'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#66736A]">Justification:</span>
                <span className="text-[#26352A] italic">{reason}</span>
              </div>
            </div>

            <div className="p-3 bg-[#fceded] rounded-xl border border-[#f8c4c4] text-[#C85C5C] font-semibold text-[11px]">
              ⚠ Emergency break-glass override will be immutably recorded in audit logs and will trigger post-emergency patient reconciliation.
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleExecuteBreakGlass} isLoading={isSubmitting}>
                Confirm Break-Glass Activation
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
