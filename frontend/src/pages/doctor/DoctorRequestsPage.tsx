import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useNotification } from '../../context/NotificationContext';
import { consentService } from '../../services/consent.service';
import {
  relationshipService,
  DoctorPatientDirectoryEntry,
} from '../../services/relationship.service';
import { AccessRequest } from '../../types/access';
import {
  ShieldAlert,
  Send,
  ShieldCheck,
  UserPlus,
  Layers,
  CheckCircle2,
  Lock,
  Clock,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const CLINICAL_CATEGORIES = [
  { id: 'Laboratory', label: 'Laboratory & Blood Panels', desc: 'CBC, Metabolic, Lipid, HbA1c, Biomarkers' },
  { id: 'Cardiology', label: 'Cardiology & ECG', desc: '12-Lead ECG, Echocardiograms, Holter Reports' },
  { id: 'Imaging', label: 'Diagnostic Imaging', desc: 'MRI, CT, X-Ray, Ultrasound, Radiology' },
  { id: 'Medication', label: 'Medications & Prescriptions', desc: 'Active & Historical Prescription Orders' },
  { id: 'Clinical', label: 'Clinical Notes & Summaries', desc: 'Outpatient, Inpatient & Discharge Summaries' },
  { id: 'Vaccination', label: 'Immunization & Vaccination', desc: 'Vaccine Dose History & Certificates' },
  { id: 'Genomic', label: 'Genomic & Precision Medicine (High Sensitivity)', desc: 'Requires explicit patient approval' },
];

export const DoctorRequestsPage: React.FC = () => {
  const { showToast } = useNotification();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get('patientId') || '';

  const [patients, setPatients] = useState<DoctorPatientDirectoryEntry[]>([]);
  const [doctorRequests, setDoctorRequests] = useState<AccessRequest[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Laboratory',
    'Cardiology',
    'Clinical',
  ]);
  const [purpose, setPurpose] = useState('Diagnosis');
  const [duration, setDuration] = useState('7');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEstablishingTrust, setIsEstablishingTrust] = useState(false);

  const loadData = async () => {
    try {
      const [dir, reqs] = await Promise.all([
        relationshipService.getPatientDirectory(),
        consentService.getDoctorAccessRequests(),
      ]);
      setPatients(dir);
      setDoctorRequests(reqs);
      if (!selectedPatientId && dir.length > 0 && initialPatientId) {
        setSelectedPatientId(initialPatientId);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load patient directory', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedPatient = patients.find(
    (p) => p.id === selectedPatientId || p.patientId === selectedPatientId
  );

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((c) => c !== categoryId) : [...prev, categoryId]
    );
  };

  const handleSelectPatientAvailableCategories = () => {
    if (selectedPatient && selectedPatient.availableCategories.length > 0) {
      setSelectedCategories([...selectedPatient.availableCategories]);
    } else {
      setSelectedCategories(['Laboratory', 'Cardiology', 'Imaging', 'Medication', 'Clinical']);
    }
  };

  const handleSelectAllStandardCategories = () => {
    setSelectedCategories([
      'Laboratory',
      'Cardiology',
      'Imaging',
      'Medication',
      'Clinical',
      'Vaccination',
    ]);
  };

  const handleEstablishTrustRelationship = async () => {
    if (!selectedPatient) return;
    setIsEstablishingTrust(true);
    try {
      await relationshipService.createRelationship({
        relationshipType: 'PATIENT_PROVIDER',
        targetId: selectedPatient.id,
        notes: 'Clinical care provider verification request (T0 -> T1)',
      });
      showToast(
        `Trust relationship request sent to ${selectedPatient.name}. Once accepted by the patient, your trust tier will advance to T1.`,
        'success'
      );
      await loadData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to initiate trust relationship',
        'error'
      );
    } finally {
      setIsEstablishingTrust(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      showToast('Please select a patient', 'warning');
      return;
    }
    if (selectedPatient.trustTier === 'T0') {
      showToast(
        'T0 Trust Restriction: Establish and activate a verified trust relationship (T1+) with this patient before requesting medical record access.',
        'error'
      );
      return;
    }
    if (selectedCategories.length === 0) {
      showToast('Please select at least one clinical record category for the patient-level scope', 'warning');
      return;
    }
    if (!purpose) {
      showToast('Please select a clinical purpose', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await consentService.createDoctorRequest({
        patientId: selectedPatient.id,
        categories: selectedCategories,
        recordType: selectedCategories.join(', '),
        purpose,
        durationDays: parseInt(duration, 10) || 7,
        clinicalNote: reason,
      });
      showToast(
        `Consolidated patient-level request (${selectedCategories.join(', ')}) sent to ${selectedPatient.name}! AI Risk Score: ${result.riskAssessment?.score ?? 15}/100`,
        'success'
      );
      await loadData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to submit patient-level access request',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const patientOptions = [
    { value: '', label: 'Select Patient...' },
    ...patients.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.patientId}) — [${p.trustTier}]`,
    })),
  ];

  const getTierBadgeVariant = (tier?: string) => {
    if (tier === 'T3') return 'sage';
    if (tier === 'T2') return 'success';
    if (tier === 'T1') return 'warning';
    return 'neutral';
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h2 className="text-2xl font-extrabold text-[#26352A]">
          Consolidated Patient-Level Access Request
        </h2>
        <p className="text-xs text-[#66736A] mt-0.5">
          Request a single patient-level clinical scope covering multiple record categories instead of separate per-document requests. Enforced by the Medrynx T0–T3 Trust Hierarchy.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card padding="lg" className="lg:col-span-2 bg-white space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Select
              label="1. Select Patient"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              options={patientOptions}
              required
            />

            {/* T0–T3 Trust Hierarchy Evaluation Banner */}
            {selectedPatient && (
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  selectedPatient.trustTier === 'T0'
                    ? 'bg-[#FFF8F6] border-[#F2C6C6]'
                    : 'bg-[#E7F0E4]/60 border-[#A8CBA0]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {selectedPatient.trustTier === 'T0' ? (
                      <Lock className="w-4 h-4 text-[#C85C5C]" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-[#47634C]" />
                    )}
                    <span className="text-xs font-extrabold text-[#26352A]">
                      Current Trust Tier: {selectedPatient.tierLabel}
                    </span>
                  </div>
                  <Badge variant={getTierBadgeVariant(selectedPatient.trustTier)}>
                    {selectedPatient.trustTier} • {selectedPatient.relationshipStatus}
                  </Badge>
                </div>

                {selectedPatient.trustTier === 'T0' ? (
                  <div className="space-y-2.5 text-xs text-[#66736A]">
                    {selectedPatient.relationshipStatus === 'PENDING' ? (
                      <div className="flex items-center gap-2 text-[#B87D14] font-semibold">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>
                          A trust relationship request is currently PENDING patient acceptance. Once {selectedPatient.name} accepts it in their Consent &amp; Trust portal, you will advance to T1 and can submit a consolidated patient-level access request.
                        </span>
                      </div>
                    ) : (
                      <>
                        <p>
                          Under the Medrynx <strong>T0 (Unknown / Unverified)</strong> security policy, clinicians cannot request or decrypt medical records until a verified <strong>T1 Trust Relationship</strong> is established with the patient.
                        </p>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          isLoading={isEstablishingTrust}
                          icon={<UserPlus className="w-3.5 h-3.5" />}
                          onClick={handleEstablishTrustRelationship}
                        >
                          Initiate Verified Trust Relationship (T0 → T1)
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-[#26352A] space-y-1.5">
                    <p>
                      ✓ Verified clinical relationship active. Submitting <strong>one patient-level request</strong> below will unlock all patient documents matching the approved categories without per-document requests.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] text-[#47634C] font-semibold">
                        Patient On-File Categories ({selectedPatient.totalRecordsCount} total documents):
                      </span>
                      {selectedPatient.availableCategories.length > 0 ? (
                        selectedPatient.availableCategories.map((cat) => (
                          <Badge key={cat} variant="neutral">
                            {cat}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[11px] text-[#66736A]">No records uploaded yet</span>
                      )}
                    </div>
                    {selectedPatient.authorizedCategories.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[11px] text-[#5F8D65] font-bold">
                          Currently Authorized Scope:
                        </span>
                        {selectedPatient.authorizedCategories.map((cat) => (
                          <Badge key={cat} variant="success">
                            ✓ {cat}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Consolidated Patient-Level Category Scope Selector */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#47634C] flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  <span>2. Consolidated Patient-Level Record Categories (Select One or More)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPatient && selectedPatient.availableCategories.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectPatientAvailableCategories}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#E7F0E4] text-[#26352A] hover:bg-[#A8CBA0]/60 transition-colors"
                    >
                      Select Patient&apos;s On-File Categories
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSelectAllStandardCategories}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#F8F3EA] text-[#47634C] hover:bg-[#DDE5DA] transition-colors"
                  >
                    All Standard Categories
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCategories([])}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-[#66736A] hover:bg-gray-100 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CLINICAL_CATEGORIES.map((cat) => {
                  const isChecked = selectedCategories.includes(cat.id);
                  const hasRecordsOnFile = selectedPatient?.availableCategories.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                        isChecked
                          ? 'bg-[#E7F0E4]/70 border-[#5F8D65] shadow-2xs'
                          : 'bg-white border-[#DDE5DA] hover:bg-[#F8F3EA]/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCategory(cat.id)}
                        className="mt-0.5 w-4 h-4 rounded accent-[#47634C]"
                      />
                      <div className="text-xs flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-[#26352A]">{cat.label}</span>
                          {hasRecordsOnFile && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#A8CBA0]/50 text-[#26352A]">
                              On File
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#66736A] block mt-0.5">{cat.desc}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="3. Clinical Purpose"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                options={[
                  { value: 'Diagnosis', label: 'Diagnosis' },
                  { value: 'Treatment', label: 'Clinical Treatment' },
                  { value: 'Follow_Up_Care', label: 'Follow-Up Care' },
                  { value: 'Second_Opinion', label: 'Second Opinion' },
                  { value: 'Surgical_Review', label: 'Surgical Review' },
                  { value: 'Medication_Management', label: 'Medication Management' },
                ]}
                required
              />

              <Select
                label="4. Requested Access Duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                options={[
                  { value: '1', label: '24 Hours (1 Day)' },
                  { value: '3', label: '3 Days' },
                  { value: '7', label: '7 Days (Standard)' },
                  { value: '14', label: '14 Days' },
                  { value: '30', label: '30 Days (Care Team Continuity)' },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#47634C]">
                Clinical Justification (Visible to Patient)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this consolidated patient-level category scope is needed for clinical care..."
                rows={2}
                className="medrynx-input"
              />
            </div>

            <div className="p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA] text-xs text-[#47634C] flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#5F8D65]" />
              <div>
                <strong className="block text-[#26352A]">
                  Single Patient-Level Request • AI Anomaly Pre-Check Active
                </strong>
                Once approved by the patient, this single grant unlocks all eligible documents in the approved categories ({selectedCategories.join(', ') || 'None selected'}) without requiring per-document requests.
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/doctor/dashboard')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                disabled={selectedPatient?.trustTier === 'T0' || selectedCategories.length === 0}
                icon={<Send className="w-4 h-4" />}
              >
                Submit Consolidated Patient-Level Request
              </Button>
            </div>
          </form>
        </Card>

        {/* T0–T3 Trust Hierarchy Reference Panel */}
        <Card padding="lg" className="bg-white space-y-4 h-fit">
          <h3 className="text-sm font-extrabold text-[#26352A] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#5F8D65]" />
            <span>Medrynx T0–T3 Trust Hierarchy</span>
          </h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-[#F8F3EA] border border-[#DDE5DA]">
              <strong className="text-[#26352A] block">T0 — Unknown / Unverified</strong>
              <span className="text-[#66736A]">
                No active relationship. Cannot view records or submit access requests until a relationship is established.
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#F8F3EA] border border-[#DDE5DA]">
              <strong className="text-[#26352A] block">T1 — Verified Relationship</strong>
              <span className="text-[#66736A]">
                Active patient-provider relationship. May submit consolidated patient-level access requests, but cannot decrypt records without consent.
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#E7F0E4]/70 border border-[#A8CBA0]">
              <strong className="text-[#26352A] block">T2 — Authorized Care Provider</strong>
              <span className="text-[#47634C]">
                Verified relationship + active patient-level consent. Unlocks all patient documents within the approved categories &amp; time window.
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#E7F0E4] border border-[#5F8D65]">
              <strong className="text-[#26352A] block">T3 — Trusted Care Team</strong>
              <span className="text-[#26352A]">
                Care-team relationship + continuity-of-care multi-category consent. Bounded by patient consent &amp; instant revocation.
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Doctor's Submitted Patient-Level Requests */}
      <Card padding="md" className="bg-white space-y-4">
        <h3 className="text-base font-bold text-[#26352A]">
          Submitted Patient-Level Access Requests ({doctorRequests.length})
        </h3>
        {doctorRequests.length === 0 ? (
          <p className="text-xs text-[#66736A] py-4 text-center">
            No patient-level access requests submitted yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#DDE5DA] text-[11px] font-bold uppercase text-[#66736A]">
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Requested Category Scope</th>
                  <th className="py-2.5 px-3">Purpose</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">AI Risk</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDE5DA]">
                {doctorRequests.map((r: any) => (
                  <tr key={r.id} className="hover:bg-[#F8F3EA]/50">
                    <td className="py-2.5 px-3 font-bold text-[#26352A]">
                      {r.patientName || r.patientId}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {(r.categories || [r.recordType]).map((cat: string) => (
                          <Badge key={cat} variant="sage">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[#66736A]">{r.purpose}</td>
                    <td className="py-2.5 px-3 text-[#66736A]">{r.durationDays} Days</td>
                    <td className="py-2.5 px-3 font-semibold">
                      {r.riskAssessment?.score ?? 15}/100
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {r.status === 'approved' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                          onClick={() => navigate('/doctor/authorized-records')}
                        >
                          Open Patient Records
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

