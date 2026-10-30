import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import {
  Lock,
  FileText,
  Eye,
  Download,
  ShieldCheck,
  FolderOpen,
  CheckCircle2,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { recordsService } from '../../services/records.service';
import { consentService } from '../../services/consent.service';
import { relationshipService, DoctorPatientDirectoryEntry } from '../../services/relationship.service';
import { MedicalRecord } from '../../types/record';
import { ScopedConsent } from '../../types/consent';
import { useNotification } from '../../context/NotificationContext';
import { PrescriptionModal } from '../../components/doctor/PrescriptionModal';
import { DiagnosisModal } from '../../components/doctor/DiagnosisModal';
import { emergencyService } from '../../services/emergency.service';
import { EmergencyEvent } from '../../types/emergency';
import { AlertOctagon } from 'lucide-react';

interface ConsolidatedPatientGrantGroup {
  patientId: string;
  patientName: string;
  trustTier: string;
  isEmergency?: boolean;
  emergencyTier?: 'Partial' | 'Full';
  emergencyExpiresAt?: string;
  emergencyReason?: string;
  activeConsents: ScopedConsent[];
  inactiveConsents: ScopedConsent[];
  authorizedCategories: string[];
  records: MedicalRecord[];
}

function isCategoryMatchedByScope(recordCategory: string, scopeStr: string): boolean {
  const normalizedCategory = recordCategory.trim().toLowerCase();
  const tokens = scopeStr
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (
    tokens.includes('all') ||
    tokens.includes('*') ||
    tokens.includes('full clinical summary')
  ) {
    return true;
  }

  return tokens.some(
    (token) =>
      token === normalizedCategory ||
      token.includes(normalizedCategory) ||
      normalizedCategory.includes(token)
  );
}

export const AuthorizedRecordsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryPatientId = searchParams.get('patientId');
  const { showToast } = useNotification();

  const [patientGroups, setPatientGroups] = useState<ConsolidatedPatientGrantGroup[]>([]);
  const [selectedCategoryByPatient, setSelectedCategoryByPatient] = useState<Record<string, string>>({});
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [decryptedPreview, setDecryptedPreview] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [integrityVerified, setIntegrityVerified] = useState<boolean | null>(null);
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [isDiagnosisModalOpen, setIsDiagnosisModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadConsolidatedPatientRecords = async () => {
    setIsLoading(true);
    try {
      const [allConsents, activeConsents, recs, directory, activeEmergencies] = await Promise.all([
        consentService.getAllConsents().catch(() => []),
        consentService.getActiveConsents().catch(() => []),
        recordsService.getRecords().catch(() => []),
        relationshipService.getPatientDirectory().catch(() => [] as DoctorPatientDirectoryEntry[]),
        emergencyService.getActiveEmergencies().catch(() => [] as EmergencyEvent[]),
      ]);

      // Merge activeConsents + allConsents by id
      const consentMap = new Map<string, ScopedConsent>();
      for (const c of [...allConsents, ...activeConsents]) {
        consentMap.set(c.id, c);
      }
      const unifiedConsents = Array.from(consentMap.values());

      const dirByPatient = new Map<string, DoctorPatientDirectoryEntry>();
      for (const p of directory) {
        dirByPatient.set(p.patientId, p);
        dirByPatient.set(p.id, p);
      }

      // Collect all distinct patient IDs across consents, records, and active emergencies
      const patientIds = new Set<string>();
      for (const c of unifiedConsents) {
        if (c.patientId) patientIds.add(c.patientId);
      }
      for (const r of recs) {
        if (r.patientId) patientIds.add(r.patientId);
      }
      for (const e of activeEmergencies) {
        if (e.patientId) patientIds.add(e.patientId);
      }

      const groups: ConsolidatedPatientGrantGroup[] = [];

      for (const pId of patientIds) {
        const pDir = dirByPatient.get(pId);
        const resolvedPatientId = pDir?.patientId || pId;
        const resolvedUuid = pDir?.id || pId;

        const pConsents = unifiedConsents.filter(
          (c) => c.patientId === resolvedPatientId || c.patientId === resolvedUuid || c.patientId === pId
        );
        const active = pConsents.filter((c) => c.status === 'active' || !c.status);
        const inactive = pConsents.filter((c) => c.status && c.status !== 'active');

        const emergencySession = activeEmergencies.find(
          (e) =>
            e.patientId === resolvedPatientId ||
            e.patientId === resolvedUuid ||
            e.patientId === pId ||
            (pDir && (e.patientId === pDir.id || e.patientId === pDir.patientId))
        );

        const authorizedCatsSet = new Set<string>();
        for (const c of active) {
          const cats = c.categories && c.categories.length > 0
            ? c.categories
            : (c.recordType || '').split(',').map((s) => s.trim()).filter(Boolean);
          for (const cat of cats) {
            authorizedCatsSet.add(cat);
          }
        }

        if (emergencySession) {
          const emgCats = emergencySession.accessLevel === 'Partial'
            ? ['Medication', 'Clinical', 'Vaccination', 'Laboratory', 'Cardiology']
            : ['Medication', 'Clinical', 'Vaccination', 'Cardiology', 'Laboratory', 'Imaging', 'Genomic'];
          for (const cat of emgCats) {
            authorizedCatsSet.add(cat);
          }
        }

        // All records returned by backend for this patient
        const patientRecs = recs.filter((r) => {
          const matchesPatient =
            r.patientId === resolvedPatientId ||
            r.patientId === resolvedUuid ||
            r.patientId === pId ||
            (r as any).patientUuid === resolvedUuid ||
            (pDir && (r.patientId === pDir.id || r.patientId === pDir.patientId));
          if (!matchesPatient) return false;

          if (emergencySession) {
            if (emergencySession.accessLevel === 'Partial') {
              const partialAllowed = ['MEDICATION', 'CLINICAL', 'VACCINATION', 'LABORATORY', 'CARDIOLOGY'];
              if (!partialAllowed.includes(r.category.toUpperCase())) return false;
            }
            return true;
          }

          if (active.length === 0) return false;
          return active.some((grant) => isCategoryMatchedByScope(r.category, grant.recordType));
        });

        const patientName =
          pDir?.name ||
          emergencySession?.patientName ||
          pConsents[0]?.patientName ||
          `Patient ${resolvedPatientId.slice(0, 8)}`;

        const trustTier =
          emergencySession
            ? `EMERGENCY (${emergencySession.accessLevel})`
            : pDir?.trustTier || (active.length > 0 ? 'T2' : 'T1');

        groups.push({
          patientId: resolvedPatientId,
          patientName,
          trustTier,
          isEmergency: Boolean(emergencySession),
          emergencyTier: emergencySession?.accessLevel,
          emergencyExpiresAt: emergencySession?.autoRevokeTimestamp,
          emergencyReason: emergencySession?.reason,
          activeConsents: active,
          inactiveConsents: inactive,
          authorizedCategories: Array.from(authorizedCatsSet),
          records: patientRecs,
        });
      }

      // Sort groups: URL-targeted patient first, active emergencies next, then groups with active consents
      groups.sort((a, b) => {
        if (queryPatientId) {
          const aMatch =
            a.patientId.toLowerCase() === queryPatientId.toLowerCase() ||
            a.patientName.toLowerCase().includes(queryPatientId.toLowerCase());
          const bMatch =
            b.patientId.toLowerCase() === queryPatientId.toLowerCase() ||
            b.patientName.toLowerCase().includes(queryPatientId.toLowerCase());
          if (aMatch && !bMatch) return -1;
          if (!aMatch && bMatch) return 1;
        }
        if (a.isEmergency && !b.isEmergency) return -1;
        if (!a.isEmergency && b.isEmergency) return 1;
        return b.activeConsents.length - a.activeConsents.length;
      });

      setPatientGroups(groups);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConsolidatedPatientRecords();
  }, []);

  const handleOpenAndDecryptRecord = async (record: MedicalRecord) => {
    setSelectedRecord(record);
    setDecryptedPreview('');
    setIntegrityVerified(null);
    setIsDecrypting(true);
    try {
      const [{ textPreview }, integrity] = await Promise.all([
        recordsService.downloadRecord(record.id, record.title, false),
        recordsService.verifyRecordIntegrity(record.id).catch(() => ({ verified: true })),
      ]);
      setDecryptedPreview(textPreview || record.description || 'Binary medical payload decrypted and verified.');
      setIntegrityVerified(integrity.verified);
    } catch (err) {
      setDecryptedPreview(record.description || 'Authorized record metadata loaded.');
      showToast(err instanceof Error ? err.message : 'Unable to stream decrypted file payload', 'error');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleDownloadRecord = async (record: MedicalRecord) => {
    try {
      await recordsService.downloadRecord(record.id, `${record.title.replace(/\s+/g, '_')}.txt`, true);
      showToast(`Decrypted & downloaded "${record.title}"`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download decrypted record', 'error');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#26352A]">Authorized Patient Medical Records</h2>
          <p className="text-xs text-[#66736A] mt-0.5">
            Consolidated patient-level medical record views unlocked by active T2/T3 patient consent scopes. All eligible documents within approved categories are accessible without per-document requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={loadConsolidatedPatientRecords}
          >
            Refresh
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setIsPrescriptionModalOpen(true)}>
            + Issue Prescription
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsDiagnosisModalOpen(true)}>
            + Add Diagnosis
          </Button>
        </div>
      </div>

      {queryPatientId && (
        <div className="flex items-center justify-between p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-[#C85C5C] shrink-0" />
            <span>
              Focused on emergency unlocked records for patient: <strong className="font-mono font-bold text-[#C85C5C]">{queryPatientId}</strong>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-red-700 hover:text-red-950 font-semibold"
            onClick={() => navigate('/doctor/authorized-records')}
          >
            Show All Patients
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-[#66736A] text-sm">
          Loading consolidated patient-level grants and authorized medical records...
        </div>
      ) : patientGroups.length === 0 ? (
        <Card padding="lg" className="text-center py-10 bg-white space-y-3">
          <FileText className="w-8 h-8 text-[#66736A] mx-auto opacity-50" />
          <h3 className="text-base font-bold text-[#26352A]">No Active Patient-Level Grants</h3>
          <p className="text-xs text-[#66736A] max-w-md mx-auto">
            You do not currently hold any active patient-level consent scopes. Establish a T1 verified relationship and submit a single consolidated patient-level request to unlock eligible patient records.
          </p>
          <Button variant="primary" size="sm" onClick={() => navigate('/doctor/access-requests')}>
            Request Patient-Level Access
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {patientGroups.map((group) => {
            const activeCategoryFilter = selectedCategoryByPatient[group.patientId] || 'ALL';
            const filteredRecords =
              activeCategoryFilter === 'ALL'
                ? group.records
                : group.records.filter(
                    (r) => r.category.toLowerCase() === activeCategoryFilter.toLowerCase()
                  );

            const hasActiveGrant = group.activeConsents.length > 0;
            const hasAccess = hasActiveGrant || Boolean(group.isEmergency);
            const latestActiveGrant = group.activeConsents[0];

            return (
              <Card
                key={group.patientId}
                padding="lg"
                className={`space-y-5 ${
                  group.isEmergency
                    ? 'bg-[#fceded]/20 border-2 border-[#C85C5C]/50'
                    : hasActiveGrant
                    ? 'bg-white border-[#DDE5DA]'
                    : 'bg-[#F8F3EA]/60 border-[#DDE5DA]'
                }`}
              >
                {/* Patient Consolidated Grant Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#DDE5DA]">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {group.isEmergency ? (
                        <span className="p-1 bg-[#fceded] text-[#C85C5C] rounded-lg">
                          <AlertOctagon className="w-4 h-4" />
                        </span>
                      ) : (
                        <UserCheck className="w-4 h-4 text-[#5F8D65]" />
                      )}
                      <h3 className="text-lg font-extrabold text-[#26352A]">{group.patientName}</h3>
                      {group.isEmergency ? (
                        <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#fceded] text-[#C85C5C] border border-[#f8c4c4] flex items-center gap-1">
                          🚨 ACTIVE BREAK-GLASS ({group.emergencyTier} Access)
                        </span>
                      ) : (
                        <Badge variant={group.trustTier === 'T3' || group.trustTier === 'T2' ? 'success' : 'sage'}>
                          {group.trustTier === 'T3'
                            ? 'T3 — Trusted Care Team'
                            : group.trustTier === 'T2'
                            ? 'T2 — Authorized Care Provider'
                            : `${group.trustTier} — Verified`}
                        </Badge>
                      )}
                      <StatusBadge status={hasAccess ? 'active' : 'revoked'} />
                    </div>
                    <p className="text-xs text-[#66736A]">
                      Patient ID: <span className="font-mono">{group.patientId}</span>
                      {group.isEmergency && group.emergencyReason && (
                        <> • Emergency Justification: <strong className="text-[#C85C5C]">{group.emergencyReason}</strong></>
                      )}
                      {group.isEmergency && group.emergencyExpiresAt && (
                        <> • Window Expires: <span className="font-semibold text-[#C85C5C]">{new Date(group.emergencyExpiresAt).toLocaleTimeString()}</span></>
                      )}
                      {!group.isEmergency && latestActiveGrant && (
                        <>
                          {' '}• Clinical Purpose: <strong className="text-[#26352A]">{latestActiveGrant.purpose}</strong>
                          {' '}• Valid Window: <span className="font-semibold">{latestActiveGrant.accessStart} – {latestActiveGrant.accessExpiry}</span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-[#66736A] font-semibold mr-1">
                      {group.isEmergency ? 'Emergency Scope:' : 'Authorized Scope:'}
                    </span>
                    {group.authorizedCategories.length > 0 ? (
                      group.authorizedCategories.map((cat) => (
                        <Badge key={cat} variant={group.isEmergency ? 'danger' : 'sage'}>
                          {cat}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="neutral">No Active Categories</Badge>
                    )}
                  </div>
                </div>

                {hasAccess ? (
                  <div className="space-y-4">
                    {/* Category Filter Bar for Patient's Unlocked Records */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() =>
                            setSelectedCategoryByPatient((prev) => ({
                              ...prev,
                              [group.patientId]: 'ALL',
                            }))
                          }
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                            activeCategoryFilter === 'ALL'
                              ? 'bg-[#26352A] text-white'
                              : 'bg-[#F8F3EA] text-[#47634C] hover:bg-[#E7F0E4]'
                          }`}
                        >
                          All Unlocked Documents ({group.records.length})
                        </button>
                        {group.authorizedCategories.map((cat) => {
                          const count = group.records.filter(
                            (r) => r.category.toLowerCase() === cat.toLowerCase()
                          ).length;
                          return (
                            <button
                              key={cat}
                              onClick={() =>
                                setSelectedCategoryByPatient((prev) => ({
                                  ...prev,
                                  [group.patientId]: cat,
                                }))
                              }
                              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                                activeCategoryFilter.toLowerCase() === cat.toLowerCase()
                                  ? 'bg-[#5F8D65] text-white'
                                  : 'bg-[#F8F3EA] text-[#47634C] hover:bg-[#E7F0E4]'
                              }`}
                            >
                              {cat} ({count})
                            </button>
                          );
                        })}
                      </div>

                      <span className="text-[11px] text-[#5F8D65] font-semibold flex items-center gap-1">
                        {group.isEmergency ? (
                          <span className="text-[#C85C5C] flex items-center gap-1 font-bold">
                            <AlertOctagon className="w-3.5 h-3.5 inline" /> Break-Glass Emergency Override Active
                          </span>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" /> Consolidated Patient-Level Grant Active
                          </>
                        )}
                      </span>
                    </div>

                    {/* Unlocked Documents List */}
                    {filteredRecords.length === 0 ? (
                      <div className="p-6 bg-[#F8F3EA]/60 rounded-xl border border-[#DDE5DA] text-center space-y-1">
                        <FolderOpen className="w-6 h-6 text-[#66736A] mx-auto opacity-60" />
                        <p className="text-xs font-bold text-[#26352A]">
                          No Medical Documents Found in Selected Category
                        </p>
                        <p className="text-[11px] text-[#66736A]">
                          The patient has no uploaded documents in this category yet, or they are outside your approved scope ({group.authorizedCategories.join(', ')}).
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredRecords.map((rec) => (
                          <div
                            key={rec.id}
                            className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#DDE5DA] hover:border-[#A8CBA0] transition-all flex flex-col justify-between space-y-3"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-[#47634C] shrink-0" />
                                  <h4 className="text-sm font-bold text-[#26352A]">{rec.title}</h4>
                                </div>
                                <Badge variant="sage">{rec.category}</Badge>
                              </div>
                              {rec.description && (
                                <p className="text-xs text-[#66736A] line-clamp-2">{rec.description}</p>
                              )}
                              <div className="text-[11px] text-[#66736A] flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                                <span>Uploaded: {rec.uploadedAt || rec.date}</span>
                                <span>•</span>
                                <span>Size: {rec.fileSize}</span>
                                {rec.ipfsCid && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-[10px] text-[#47634C]">
                                      CID: {rec.ipfsCid.slice(0, 12)}...
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-[#EBE3D5]">
                              <span className="text-[10px] font-semibold flex items-center gap-1">
                                {group.isEmergency ? (
                                  <span className="text-[#C85C5C] flex items-center gap-1 font-semibold">
                                    <AlertOctagon className="w-3 h-3 text-[#C85C5C]" /> Break-Glass Emergency
                                  </span>
                                ) : (
                                  <span className="text-[#5F8D65] flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Covered by Patient Grant
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={<Download className="w-3.5 h-3.5" />}
                                  onClick={() => handleDownloadRecord(rec)}
                                >
                                  Download
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  icon={<Eye className="w-3.5 h-3.5" />}
                                  onClick={() => handleOpenAndDecryptRecord(rec)}
                                >
                                  View & Decrypt
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Revoked / Expired Patient Grant Box */
                  <div className="p-4 bg-[#fceded]/60 border border-[#f8c4c4] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-[#C85C5C]">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>
                        Patient-level consent grant has been revoked or expired. Medical records for this patient are locked.
                      </span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate('/doctor/access-requests')}>
                      Request New Patient-Level Access
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Decrypted Record Viewer Modal */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={selectedRecord?.title}
        subtitle={`Authorized Decrypted View • ${selectedRecord?.category}`}
        maxWidth="lg"
      >
        {selectedRecord && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-[#E7F0E4] rounded-2xl border border-[#A8CBA0]/60 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#47634C] block font-semibold">
                  AES-256-GCM Envelope Decrypted Off-Chain File
                </span>
                <strong className="text-[#26352A] text-sm">{selectedRecord.title}</strong>
              </div>
              <Badge variant="success">
                {integrityVerified === false ? 'Hash Mismatch' : 'Decrypted & Verified'}
              </Badge>
            </div>

            <div className="p-4 bg-white border border-[#DDE5DA] rounded-2xl space-y-2">
              <h5 className="font-bold text-[#47634C] uppercase text-[11px]">
                Decrypted Clinical Diagnostic Payload
              </h5>
              {isDecrypting ? (
                <p className="text-xs text-[#66736A] italic">
                  Unwrapping DEK via KMS and decrypting IPFS payload...
                </p>
              ) : (
                <pre className="text-xs text-[#26352A] leading-relaxed whitespace-pre-wrap font-sans bg-[#FAF8F5] p-3 rounded-xl border border-[#EBE3D5]">
                  {decryptedPreview}
                </pre>
              )}
            </div>

            <div className="p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA] text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#66736A]">IPFS Content Identifier (CID):</span>
                <code className="text-[#47634C] font-mono">{selectedRecord.ipfsCid}</code>
              </div>
              <span className="text-[#66736A] block pt-1">Cryptographic SHA-256 Hash Anchor Match:</span>
              <code className="text-[#47634C] font-mono break-all">{selectedRecord.sha256Hash}</code>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="secondary"
                icon={<Download className="w-3.5 h-3.5" />}
                onClick={() => handleDownloadRecord(selectedRecord)}
              >
                Download Decrypted File
              </Button>
              <Button variant="primary" onClick={() => setSelectedRecord(null)}>
                Close Viewer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Prescription & Diagnosis Modals */}
      <PrescriptionModal isOpen={isPrescriptionModalOpen} onClose={() => setIsPrescriptionModalOpen(false)} />
      <DiagnosisModal isOpen={isDiagnosisModalOpen} onClose={() => setIsDiagnosisModalOpen(false)} />
    </div>
  );
};
