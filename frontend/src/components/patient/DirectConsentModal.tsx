import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { consentService } from '../../services/consent.service';
import { relationshipService, DoctorDirectoryEntry } from '../../services/relationship.service';
import { useNotification } from '../../context/NotificationContext';
import { ShieldCheck, UserCheck, KeyRound, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface DirectConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const RECORD_CATEGORIES = [
  { value: 'Cardiology', label: 'Cardiology & ECG' },
  { value: 'Laboratory', label: 'Laboratory & Blood Panels' },
  { value: 'Imaging', label: 'Radiology / MRI / CT / X-Ray' },
  { value: 'Medication', label: 'Medications & Prescriptions' },
  { value: 'Clinical', label: 'Clinical Consultation Notes' },
  { value: 'Vaccination', label: 'Immunization & Vaccines' },
  { value: 'Genomic', label: 'Genomics & Sequencing' },
];

export const DirectConsentModal: React.FC<DirectConsentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useNotification();
  const [doctors, setDoctors] = useState<DoctorDirectoryEntry[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Laboratory',
    'Clinical',
    'Medication',
  ]);
  const [durationDays, setDurationDays] = useState<number>(14);
  const [purpose, setPurpose] = useState<string>('Outpatient consultation and treatment monitoring');
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingDoctors(true);
      setError(null);
      relationshipService
        .getDoctorsDirectory()
        .then((docList) => {
          setDoctors(docList);
          if (docList.length > 0 && !selectedDoctorId) {
            setSelectedDoctorId(docList[0].id);
          }
        })
        .catch(() => {
          // Fallback demo clinicians
          const fallbackDocs: DoctorDirectoryEntry[] = [
            {
              id: '6e2931bf-9c98-4793-af28-e1385330bfde',
              doctorId: 'd-514',
              name: 'Dr. Marcus Vance',
              email: 'doctor.vance@medrynx.org',
              specialization: 'Cardiology',
              hospital: 'Mount Sinai Hospital',
            },
            {
              id: '89120611-780a-4398-b948-b52c639fea5d',
              doctorId: 'd-515',
              name: 'Dr. Evelyn Vance',
              email: 'doctor.evelyn@medrynx.org',
              specialization: 'Neurology / Pulmonology',
              hospital: 'Metro Health Medical Center',
            },
          ];
          setDoctors(fallbackDocs);
          if (fallbackDocs.length > 0 && !selectedDoctorId) {
            setSelectedDoctorId(fallbackDocs[0].id);
          }
        })
        .finally(() => setIsLoadingDoctors(false));
    }
  }, [isOpen]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleSelectAllCategories = () => {
    if (selectedCategories.length === RECORD_CATEGORIES.length) {
      setSelectedCategories(['Clinical']);
    } else {
      setSelectedCategories(RECORD_CATEGORIES.map((c) => c.value));
    }
  };

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctorId) {
      setError('Please select a healthcare clinician.');
      return;
    }
    if (selectedCategories.length === 0) {
      setError('Please select at least one record category to authorize.');
      return;
    }
    if (!purpose.trim()) {
      setError('Please specify a clinical purpose for this consent grant.');
      return;
    }
    if (!acknowledged) {
      setError('Please acknowledge the cryptographic scope declaration.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await consentService.createDirectConsent({
        doctorId: selectedDoctorId,
        categories: selectedCategories,
        durationDays,
        purpose: purpose.trim(),
      });

      showToast(
        `Dynamic consent granted to ${selectedDoctor?.name || 'Clinician'} for [${selectedCategories.join(', ')}] (${durationDays} days)`,
        'success'
      );
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to grant consent.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Grant Patient-Level Consent to Clinician"
      subtitle="Establish dynamic T2 authorization by choosing clinician, categories, and time window"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5 font-sans">
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Clinician Selection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#26352A]">
            Select Attending Clinician / Doctor
          </label>
          {isLoadingDoctors ? (
            <div className="p-3 text-xs text-[#66736A] bg-[#FAF8F5] rounded-xl border border-[#DDE5DA]">
              Loading verified network clinicians...
            </div>
          ) : (
            <Select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              options={doctors.map((d) => ({
                value: d.id,
                label: `${d.name} (${d.specialization}) — ${d.hospital}`,
              }))}
            />
          )}

          {selectedDoctor && (
            <div className="p-3 bg-[#F8F3EA] rounded-xl border border-[#DDE5DA] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#5F8D65]" />
                <div>
                  <span className="font-bold text-[#26352A] block">{selectedDoctor.name}</span>
                  <span className="text-[11px] text-[#66736A]">{selectedDoctor.email}</span>
                </div>
              </div>
              <Badge variant="success">T1 Verified Provider</Badge>
            </div>
          )}
        </div>

        {/* Scoped Categories Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#26352A]">
              Authorized Record Categories (Patient-Level ABAC)
            </label>
            <button
              type="button"
              onClick={handleSelectAllCategories}
              className="text-xs font-bold text-[#47634C] hover:text-[#26352A] underline cursor-pointer"
            >
              {selectedCategories.length === RECORD_CATEGORIES.length ? 'Deselect All' : 'Select All Categories'}
            </button>
          </div>
          <p className="text-[11px] text-[#66736A]">
            Only documents matching the selected categories will be decryptable by the doctor during the active window.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {RECORD_CATEGORIES.map((cat) => {
              const isChecked = selectedCategories.includes(cat.value);
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => toggleCategory(cat.value)}
                  className={`p-2.5 rounded-xl text-left border transition-all text-xs flex items-center justify-between cursor-pointer ${
                    isChecked
                      ? 'bg-[#E7F0E4] border-[#5F8D65] text-[#26352A] font-bold shadow-xs'
                      : 'bg-white border-[#DDE5DA] text-[#66736A] hover:bg-[#FAF8F5]'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] ${
                      isChecked ? 'bg-[#5F8D65] text-white' : 'border border-[#DDE5DA]'
                    }`}
                  >
                    {isChecked ? '✓' : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Validity Duration & Purpose */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#26352A]">
              Access Validity Duration
            </label>
            <Select
              value={String(durationDays)}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              options={[
                { value: '3', label: '3 Days (Acute Review)' },
                { value: '7', label: '7 Days (Standard Consultation)' },
                { value: '14', label: '14 Days (Care Episode)' },
                { value: '30', label: '30 Days (Ongoing Treatment)' },
                { value: '90', label: '90 Days (Quarterly Chronic Care)' },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#26352A]">
              Clinical Purpose
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Outpatient cardiology assessment"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D5DFD3] text-xs text-[#26352A] focus:outline-none focus:ring-2 focus:ring-[#A8CBA0]/40"
            />
          </div>
        </div>

        {/* Cryptographic Scope Declaration */}
        <div className="p-3.5 bg-[#FAF8F5] rounded-xl border border-[#EBE3D5] space-y-2">
          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#26352A]">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5 rounded border-[#DDE5DA] text-[#47634C] focus:ring-[#A8CBA0]"
            />
            <span className="leading-relaxed">
              I authorize the Medrynx Policy Engine to anchor this dynamic consent on the smart contract registry. I understand I can immediately revoke this grant at any time from this dashboard.
            </span>
          </label>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#DDE5DA]">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={<KeyRound className="w-4 h-4" />}
            disabled={isSubmitting || selectedCategories.length === 0}
          >
            {isSubmitting ? 'Anchoring On-Chain…' : `Grant Access (${durationDays} Days)`}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
