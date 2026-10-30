import React, { useState, useEffect } from 'react';
import { consentService } from '../../services/consent.service';
import { relationshipService, TrustRelationship } from '../../services/relationship.service';
import { ScopedConsent, ConsentBatch } from '../../types/consent';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { DirectConsentModal } from '../../components/patient/DirectConsentModal';
import { useNotification } from '../../context/NotificationContext';
import { KeyRound, Layers, Ban, CheckCircle2, ShieldCheck, Clock, UserCheck, Users, Building2 } from 'lucide-react';

export const ConsentManagementPage: React.FC = () => {
  const { showToast } = useNotification();
  const [allConsents, setAllConsents] = useState<ScopedConsent[]>([]);
  const [activeConsents, setActiveConsents] = useState<ScopedConsent[]>([]);
  const [consentFilter, setConsentFilter] = useState<'all' | 'active' | 'revoked' | 'expired'>('active');
  const [batches, setBatches] = useState<ConsentBatch[]>([]);
  const [relationships, setRelationships] = useState<TrustRelationship[]>([]);
  const [selectedConsentForRevoke, setSelectedConsentForRevoke] = useState<ScopedConsent | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isDirectConsentModalOpen, setIsDirectConsentModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = () => {
    setIsLoading(true);
    setLoadError(null);
    Promise.all([
      consentService.getActiveConsents(),
      consentService.getAllConsents(),
      consentService.getConsentBatches().catch(() => []),
      relationshipService.getRelationships().catch(() => []),
    ])
      .then(([active, all, batchList, relList]) => {
        setActiveConsents(active);
        setAllConsents(all);
        setBatches(batchList);
        setRelationships(relList);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load consent data');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConfirmRevoke = async () => {
    if (!selectedConsentForRevoke) return;
    setIsRevoking(true);
    await consentService.revokeConsent(selectedConsentForRevoke.id);
    setIsRevoking(false);
    setActiveConsents((prev) => prev.filter((c) => c.id !== selectedConsentForRevoke.id));
    setAllConsents((prev) => prev.map((c) => c.id === selectedConsentForRevoke.id ? { ...c, status: 'revoked' } : c));
    showToast(`Access revoked for ${selectedConsentForRevoke.doctorName}`, 'success');
    setSelectedConsentForRevoke(null);
  };

  const handleGrantBatch = async (batchId: string) => {
    await consentService.grantBatchConsent(batchId);
    setBatches((prev) => prev.filter((b) => b.id !== batchId));
    showToast('Batch consent granted for all care team clinicians!', 'success');
    consentService.getActiveConsents().then(setActiveConsents);
    consentService.getAllConsents().then(setAllConsents);
  };

  const handleRejectBatch = (batchId: string) => {
    setBatches((prev) => prev.filter((b) => b.id !== batchId));
    showToast('Batch requests rejected', 'info');
  };

  return (
    <div className="space-y-8 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#26352A]">Consent Management</h2>
          <p className="text-xs text-[#66736A] mt-0.5">
            Manage active clinician authorization scopes, direct patient consent grants, and grouped batches.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<KeyRound className="w-4 h-4" />}
          onClick={() => setIsDirectConsentModalOpen(true)}
        >
          + Grant Doctor Access
        </Button>
      </div>

      {/* CONSENT BATCHING SECTION (Section 18) */}
      {batches.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#47634C]" />
            <h3 className="text-lg font-bold text-[#26352A]">Grouped Consent Batching</h3>
          </div>

          {batches.map((batch) => {
            const cliniciansList = batch.clinicians || (batch as any).doctors || [];
            return (
              <Card key={batch.id} padding="lg" className="bg-[#E7F0E4]/40 border-[#A8CBA0] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="sage">{batch.title}</Badge>
                      <Badge variant="success">Low Risk</Badge>
                    </div>
                    <p className="text-xs text-[#66736A] mt-1">{batch.description}</p>
                  </div>
                  <span className="text-xs font-semibold text-[#47634C]">
                    Target Record: {batch.recordType}
                  </span>
                </div>

                {/* Clinicians Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {cliniciansList.map((c: any, idx: number) => (
                    <div key={c.id || idx} className="p-3 bg-white rounded-xl border border-[#DDE5DA] text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[#26352A]">
                        <UserCheck className="w-3.5 h-3.5 text-[#5F8D65]" />
                        <span>{c.name || 'Attending Physician'}</span>
                      </div>
                      <p className="text-[11px] text-[#66736A]">{c.specialty || 'General'}</p>
                      <p className="text-[10px] text-[#47634C]">{c.hospital || 'Hospital'}</p>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-[#26352A] bg-white/80 p-3 rounded-xl border border-[#DDE5DA]">
                  💡 Instead of reviewing each request individually, you can review this low-risk group as a single unified consent decision.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button variant="danger" size="sm" onClick={() => handleRejectBatch(batch.id)}>
                    Reject All
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => handleGrantBatch(batch.id)}>
                    Grant All ({cliniciansList.length || 4} Clinicians)
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* CONSENT LIFECYCLE & ACCESS SECTION */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-[#5F8D65]" />
            <h3 className="text-lg font-bold text-[#26352A]">Patient Dynamic Consents</h3>
          </div>
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#DDE5DA] text-xs font-semibold">
            <button
              onClick={() => setConsentFilter('active')}
              className={`py-1.5 px-3 rounded-lg transition-all ${
                consentFilter === 'active' ? 'bg-[#A8CBA0] text-[#26352A] shadow-xs' : 'text-[#66736A] hover:bg-[#F2E7D5]/50'
              }`}
            >
              Active ({allConsents.filter((c) => (c.status === 'active' || !c.status)).length})
            </button>
            <button
              onClick={() => setConsentFilter('revoked')}
              className={`py-1.5 px-3 rounded-lg transition-all ${
                consentFilter === 'revoked' ? 'bg-[#A8CBA0] text-[#26352A] shadow-xs' : 'text-[#66736A] hover:bg-[#F2E7D5]/50'
              }`}
            >
              Revoked ({allConsents.filter((c) => c.status === 'revoked').length})
            </button>
            <button
              onClick={() => setConsentFilter('expired')}
              className={`py-1.5 px-3 rounded-lg transition-all ${
                consentFilter === 'expired' ? 'bg-[#A8CBA0] text-[#26352A] shadow-xs' : 'text-[#66736A] hover:bg-[#F2E7D5]/50'
              }`}
            >
              Expired ({allConsents.filter((c) => c.status === 'expired').length})
            </button>
            <button
              onClick={() => setConsentFilter('all')}
              className={`py-1.5 px-3 rounded-lg transition-all ${
                consentFilter === 'all' ? 'bg-[#A8CBA0] text-[#26352A] shadow-xs' : 'text-[#66736A] hover:bg-[#F2E7D5]/50'
              }`}
            >
              All ({allConsents.length})
            </button>
          </div>
        </div>

        {(() => {
          const filteredConsents = allConsents.filter((c) => {
            if (consentFilter === 'active') return c.status === 'active' || !c.status;
            if (consentFilter === 'revoked') return c.status === 'revoked';
            if (consentFilter === 'expired') return c.status === 'expired';
            return true;
          });

          if (isLoading) {
            return (
              <Card padding="lg" className="text-center py-12 text-[#66736A] text-xs">
                Loading active and historical consents...
              </Card>
            );
          }

          if (loadError) {
            return (
              <Card padding="lg" className="text-center py-12 text-[#C85C5C] text-xs">
                Unable to load consent data: {loadError}
              </Card>
            );
          }

          if (filteredConsents.length === 0) {
            return (
              <Card padding="lg" className="text-center py-12 text-[#66736A] space-y-2">
                <CheckCircle2 className="w-10 h-10 text-[#5F8D65] mx-auto" />
                <h4 className="text-base font-bold text-[#26352A]">No Consents in this View</h4>
                <p className="text-xs">There are no clinician consent grants matching the &quot;{consentFilter}&quot; filter.</p>
              </Card>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredConsents.map((consent) => {
                const isActive = consent.status === 'active' || !consent.status;
                const categories =
                  consent.categories && consent.categories.length > 0
                    ? consent.categories
                    : (consent.recordType || '')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                return (
                  <Card key={consent.id} padding="lg" className="space-y-4 bg-white border-[#DDE5DA]">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-[#26352A]">{consent.doctorName || 'Attending Physician'}</h4>
                          <Badge variant={isActive ? 'success' : 'neutral'}>
                            {consent.trustTier || (isActive ? 'T2 — Authorized' : 'T1')}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#66736A]">{consent.hospital || 'Medical Center'} • {consent.doctorSpecialty || 'Clinical Care'}</p>
                      </div>
                      <StatusBadge status={consent.status || 'active'} />
                    </div>

                    <div className="p-3 bg-[#F8F3EA] rounded-xl text-xs space-y-2 border border-[#DDE5DA]">
                      <div className="space-y-1">
                        <span className="text-[#66736A] block">Authorized Patient-Level Record Categories:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {categories.map((cat) => (
                            <Badge key={cat} variant="sage">
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-[#EBE3D5]">
                        <span className="text-[#66736A]">Clinical Purpose:</span>
                        <strong className="text-[#26352A]">{consent.purpose}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#66736A]">Granted Date:</span>
                        <span>{String(consent.grantedAt || '')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#66736A]">Expiry Window:</span>
                        <strong className={isActive ? 'text-[#C85C5C]' : 'text-[#66736A]'}>
                          {String(consent.accessExpiry || '')}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#DDE5DA]">
                      <span className="text-[11px] text-[#5F8D65] font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Patient-Level Scope Bound & Monitored
                      </span>
                      {isActive && (
                        <Button
                          variant="danger"
                          size="sm"
                          icon={<Ban className="w-3.5 h-3.5" />}
                          onClick={() => setSelectedConsentForRevoke(consent)}
                        >
                          Revoke Access
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* TRUST & CARE TEAM RELATIONSHIPS SECTION */}
      <div className="space-y-4 pt-4 border-t border-[#DDE5DA]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#47634C]" />
            <h3 className="text-lg font-bold text-[#26352A]">Verified Healthcare & Provider Relationships (T0–T3)</h3>
          </div>
          <Badge variant="neutral">{relationships.filter((r) => r.status === 'ACTIVE').length} Active Affiliations</Badge>
        </div>
        <p className="text-xs text-[#66736A]">
          Explicit participant associations establishing T1–T3 clinical trust and institutional context. T1 relationships allow a clinician to submit a consolidated patient-level access request, but never grant automatic medical record access without explicit patient consent (T2/T3).
        </p>

        {relationships.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-[#DDE5DA] text-xs text-[#66736A]">
            No trust relationships currently established.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {relationships.map((rel) => (
              <Card key={rel.id} className="p-5 flex flex-col justify-between border-[#DDE5DA] hover:border-[#A8CBA0] transition-all">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        {rel.targetType === 'ORGANIZATION' ? (
                          <Building2 className="w-4 h-4 text-[#5F8D65]" />
                        ) : (
                          <UserCheck className="w-4 h-4 text-[#5F8D65]" />
                        )}
                        <h4 className="text-sm font-bold text-[#26352A]">{rel.targetName || 'Provider'}</h4>
                      </div>
                      <p className="text-[11px] text-[#66736A] mt-0.5">
                        {rel.organizationName || 'Medrynx Network'} {rel.notes ? `• ${rel.notes}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {rel.trustTier && (
                        <Badge variant={rel.trustTier === 'T3' || rel.trustTier === 'T2' ? 'success' : rel.trustTier === 'T1' ? 'sage' : 'warning'}>
                          {rel.trustTier}
                        </Badge>
                      )}
                      <Badge variant={rel.status === 'ACTIVE' ? 'success' : rel.status === 'PENDING' ? 'warning' : 'neutral'}>
                        {rel.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="bg-[#FAF8F5] p-2.5 rounded-xl border border-[#EBE3D5] text-[11px] space-y-1">
                    <div className="flex justify-between text-[#66736A]">
                      <span>Relationship Type:</span>
                      <span className="font-semibold text-[#26352A]">{rel.relationshipType.replace(/_/g, ' ')}</span>
                    </div>
                    {rel.tierLabel && (
                      <div className="flex justify-between text-[#66736A]">
                        <span>Trust Tier Status:</span>
                        <span className="font-semibold text-[#47634C]">{rel.tierLabel}</span>
                      </div>
                    )}
                    {rel.onChainTxHash && (
                      <div className="flex justify-between text-[#66736A]">
                        <span>On-Chain Verified:</span>
                        <span className="font-mono text-[10px] text-[#47634C]">{rel.onChainTxHash.slice(0, 14)}...</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-[#F2E7D5]">
                  <span className="text-[11px] text-[#66736A]">
                    {rel.expiresAt ? `Valid until ${new Date(rel.expiresAt).toLocaleDateString('en-GB')}` : 'Perpetual Affiliation'}
                  </span>
                  {rel.status === 'ACTIVE' && (
                    <div className="flex items-center gap-2">
                      {rel.relationshipType === 'PATIENT_PROVIDER' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            await relationshipService.transitionRelationship(rel.id, 'PATIENT_CARE_TEAM');
                            showToast(`Upgraded ${rel.targetName} to T3 Care Team relationship`, 'success');
                            relationshipService.getRelationships().then(setRelationships);
                          }}
                        >
                          Promote to Care Team (T3)
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#C85C5C] hover:bg-[#fceded]"
                        onClick={async () => {
                          await relationshipService.revokeRelationship(rel.id);
                          showToast(`Trust relationship with ${rel.targetName} revoked (all active grants terminated)`, 'info');
                          const [relList, active, all] = await Promise.all([
                            relationshipService.getRelationships().catch(() => []),
                            consentService.getActiveConsents().catch(() => []),
                            consentService.getAllConsents().catch(() => []),
                          ]);
                          setRelationships(relList);
                          setActiveConsents(active);
                          setAllConsents(all);
                        }}
                      >
                        Revoke
                      </Button>
                    </div>
                  )}
                  {rel.status === 'PENDING' && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#C85C5C] hover:bg-[#fceded]"
                        onClick={async () => {
                          await relationshipService.rejectRelationship(rel.id);
                          showToast(`Trust relationship with ${rel.targetName} rejected`, 'info');
                          relationshipService.getRelationships().then(setRelationships);
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          await relationshipService.acceptRelationship(rel.id);
                          showToast(`Trust relationship with ${rel.targetName} accepted (T1 Verified)`, 'success');
                          relationshipService.getRelationships().then(setRelationships);
                        }}
                      >
                        Accept (T1)
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Revoke Confirmation Dialog */}
      <Modal
        isOpen={!!selectedConsentForRevoke}
        onClose={() => setSelectedConsentForRevoke(null)}
        title="Revoke Access?"
        subtitle="Immediate clinician access termination"
      >
        {selectedConsentForRevoke && (
          <div className="space-y-4 text-xs">
            <p className="text-[#26352A] leading-relaxed">
              <strong>{selectedConsentForRevoke.doctorName}</strong> ({selectedConsentForRevoke.hospital}) will no longer be able to access your <strong>{selectedConsentForRevoke.recordType}</strong> records.
            </p>

            <div className="p-3 bg-[#fceded] rounded-xl border border-[#f8c4c4] text-[#C85C5C]">
              ⚠ Revocation is instantaneous and will be recorded in the immutable audit log.
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button variant="secondary" onClick={() => setSelectedConsentForRevoke(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirmRevoke} isLoading={isRevoking}>
                Confirm Revoke Access
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Direct Patient-Initiated Consent Grant Modal */}
      <DirectConsentModal
        isOpen={isDirectConsentModalOpen}
        onClose={() => setIsDirectConsentModalOpen(false)}
        onSuccess={loadData}
      />
    </div>
  );
};
