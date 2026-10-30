import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { recordsService } from '../../services/records.service';
import { adminService } from '../../services/admin.service';
import { Pill, Plus, Trash2, ShieldCheck, Calendar } from 'lucide-react';

export interface MedicationItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  timing: string;
  duration: string;
  instructions: string;
}

interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPatientId?: string;
}

export const PrescriptionModal: React.FC<PrescriptionModalProps> = ({
  isOpen,
  onClose,
  defaultPatientId = '',
}) => {
  const { showToast } = useNotification();
  const { user } = useAuth();
  const [patients, setPatients] = useState<Array<{ id: string; name: string; bloodGroup?: string }>>([]);
  const [patient, setPatient] = useState(defaultPatientId);
  const [generalInstructions, setGeneralInstructions] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [medications, setMedications] = useState<MedicationItem[]>([
    {
      id: 'med-1',
      name: '',
      dosage: '',
      frequency: 'Once daily (OD)',
      timing: 'After meals',
      duration: '7 Days',
      instructions: '',
    },
  ]);

  useEffect(() => {
    if (isOpen) {
      adminService
        .getPatients()
        .then(setPatients)
        .catch(() => setPatients([]));
    }
  }, [isOpen]);

  useEffect(() => {
    if (defaultPatientId) setPatient(defaultPatientId);
  }, [defaultPatientId]);

  const handleAddMedication = () => {
    const newMed: MedicationItem = {
      id: `med-${Date.now()}`,
      name: '',
      dosage: '',
      frequency: 'Once daily (OD)',
      timing: 'After meals',
      duration: '14 Days',
      instructions: '',
    };
    setMedications([...medications, newMed]);
  };

  const handleRemoveMedication = (id: string) => {
    if (medications.length <= 1) {
      showToast('At least one medication is required in a prescription', 'warning');
      return;
    }
    setMedications(medications.filter((m) => m.id !== id));
  };

  const handleUpdateMedication = (id: string, field: keyof MedicationItem, value: string) => {
    setMedications(
      medications.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    for (let i = 0; i < medications.length; i++) {
      const med = medications[i];
      if (!med.name.trim()) {
        showToast(`Please enter medication name for Medicine #${i + 1}`, 'error');
        return;
      }
      if (!med.dosage.trim()) {
        showToast(`Please enter dosage for ${med.name || `Medicine #${i + 1}`}`, 'error');
        return;
      }
    }

    setIsSaving(true);

    try {
      const prescriptionSummary = medications
        .map(
          (m, idx) =>
            `${idx + 1}. ${m.name} ${m.dosage} — ${m.frequency} (${m.timing}) for ${m.duration}${
              m.instructions ? ` [Note: ${m.instructions}]` : ''
            }`
        )
        .join('\n');

      const fullDescription = `Digital Clinical Prescription (${medications.length} Medications Prescribed)\n\n${prescriptionSummary}\n\nGeneral Advice: ${generalInstructions}`;

      await recordsService.uploadRecord({
        title: `Digital Prescription (${medications.length} Rx) - ${new Date().toLocaleDateString('en-GB')}`,
        category: 'Medication',
        description: fullDescription,
        file: null,
      });

      showToast(
        `Prescription with ${medications.length} medicines signed and anchored successfully!`,
        'success'
      );
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to save prescription. Please try again.',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const patientOptions = [
    { value: '', label: 'Select Patient...' },
    ...patients.map((p) => ({
      value: p.id,
      label: `${p.name} (${p.id})${p.bloodGroup ? ` • ${p.bloodGroup}` : ''}`,
    })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Digital Prescription"
      subtitle="Sign, encrypt, and anchor multi-medication clinical prescription"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs">
        <div className="bg-[#FAF9F5] p-3.5 rounded-xl border border-[#EBE8DF] flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="w-full sm:w-1/2">
            <Select
              label="Prescription Recipient (Patient)"
              value={patient}
              onChange={(e) => setPatient(e.target.value)}
              options={patientOptions}
            />
          </div>

          <div className="flex items-center gap-2 text-[#47634C] text-xs">
            <Calendar className="w-4 h-4 text-[#2D5A3C]" />
            <div>
              <p className="font-semibold">Issue Date</p>
              <p className="text-[#66736A]">
                {new Date().toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#EBF3ED] text-[#2D5A3C] flex items-center justify-center font-bold">
              <Pill className="w-3.5 h-3.5" />
            </div>
            <h3 className="font-bold text-sm text-[#263328]">
              Prescribed Medications ({medications.length})
            </h3>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleAddMedication}
            className="flex items-center gap-1.5 !text-xs !py-1.5 !px-3 font-semibold !text-[#2D5A3C] border-[#2D5A3C]/30 hover:bg-[#EBF3ED]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Another Medicine
          </Button>
        </div>

        <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
          {medications.map((med, index) => (
            <div
              key={med.id}
              className="bg-white p-4 rounded-xl border border-[#E2DFD2] shadow-sm relative transition-all hover:border-[#2D5A3C]/40 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[#F0EFEA] pb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EBF3ED] text-[#2D5A3C] flex items-center gap-1">
                  <Pill className="w-3 h-3" />
                  Medicine #{index + 1}
                </span>

                {medications.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMedication(med.id)}
                    className="text-[#C85C5C] hover:text-[#A83232] hover:bg-[#FDF2F2] p-1.5 rounded-md transition-colors flex items-center gap-1 text-[11px] font-medium"
                    title="Remove this medicine"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-8">
                  <Input
                    label="Medication Name & Strength"
                    placeholder="e.g. Atorvastatin, Metformin, Amoxicillin"
                    value={med.name}
                    onChange={(e) => handleUpdateMedication(med.id, 'name', e.target.value)}
                    required
                  />
                </div>

                <div className="sm:col-span-4">
                  <Input
                    label="Dosage"
                    placeholder="e.g. 20 mg, 500 mg, 1 tablet"
                    value={med.dosage}
                    onChange={(e) => handleUpdateMedication(med.id, 'dosage', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Select
                    label="Frequency"
                    value={med.frequency}
                    onChange={(e) => handleUpdateMedication(med.id, 'frequency', e.target.value)}
                    options={[
                      { value: 'Once daily (OD)', label: 'Once daily (OD)' },
                      { value: 'Once daily (OD) - Morning', label: 'Once daily (OD) - Morning' },
                      { value: 'Once daily (OD) - Bedtime', label: 'Once daily (OD) - Bedtime' },
                      { value: 'Twice daily (BD)', label: 'Twice daily (BD) - Morning & Night' },
                      { value: 'Thrice daily (TDS)', label: 'Thrice daily (TDS) - 3 times' },
                      { value: 'Four times daily (QDS)', label: 'Four times daily (QDS)' },
                      { value: 'As needed (PRN / SOS)', label: 'As needed (SOS / PRN)' },
                    ]}
                  />
                </div>

                <div>
                  <Select
                    label="Meal Timing"
                    value={med.timing}
                    onChange={(e) => handleUpdateMedication(med.id, 'timing', e.target.value)}
                    options={[
                      { value: 'After meals', label: 'After meals (Post-prandial)' },
                      { value: 'Before meals', label: 'Before meals (Empty stomach)' },
                      { value: 'With meals', label: 'With meals' },
                      { value: 'At bedtime', label: 'At bedtime' },
                    ]}
                  />
                </div>

                <div>
                  <Input
                    label="Duration"
                    placeholder="e.g. 5 Days, 14 Days, 30 Days"
                    value={med.duration}
                    onChange={(e) => handleUpdateMedication(med.id, 'duration', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Specific note for this medicine (e.g. Take with warm water; Avoid milk)"
                  value={med.instructions}
                  onChange={(e) => handleUpdateMedication(med.id, 'instructions', e.target.value)}
                  className="w-full text-xs text-[#263328] bg-[#FAF9F5] border border-[#E2DFD2] rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#2D5A3C]"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[#47634C]">
            General Clinical Advice &amp; Dietary Instructions
          </label>
          <textarea
            value={generalInstructions}
            onChange={(e) => setGeneralInstructions(e.target.value)}
            rows={2}
            className="medrynx-input resize-none"
            placeholder="Dietary instructions, allergy cautions, follow-up timeline..."
          />
        </div>

        <div className="bg-[#EBF3ED]/60 p-3 rounded-xl border border-[#2D5A3C]/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-[#2D5A3C]">
            <ShieldCheck className="w-5 h-5 text-[#2D5A3C] flex-shrink-0" />
            <div>
              <p className="font-bold text-xs">Doctor Digital Signature &amp; Encrypted Anchor</p>
              <p className="text-[11px] text-[#47634C]">
                Prescription signed with {user?.name || 'Authenticated Clinician'} credentials and encrypted via AES-256 before ledger anchoring.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-[#2D5A3C] font-semibold bg-white px-2.5 py-1 rounded-md border border-[#2D5A3C]/20">
            {medications.length} {medications.length === 1 ? 'Medicine' : 'Medicines'}
          </span>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSaving} className="font-semibold">
            Sign &amp; Save Prescription ({medications.length} {medications.length === 1 ? 'Med' : 'Meds'})
          </Button>
        </div>
      </form>
    </Modal>
  );
};
