import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useNotification } from '../../context/NotificationContext';
import { recordsService } from '../../services/records.service';
import { adminService } from '../../services/admin.service';

interface DiagnosisModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPatientId?: string;
}

export const DiagnosisModal: React.FC<DiagnosisModalProps> = ({
  isOpen,
  onClose,
  defaultPatientId = '',
}) => {
  const { showToast } = useNotification();
  const [patients, setPatients] = useState<Array<{ id: string; name: string }>>([]);
  const [patient, setPatient] = useState(defaultPatientId);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [followup, setFollowup] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) {
      showToast('Please select a patient', 'warning');
      return;
    }
    if (!diagnosis.trim()) {
      showToast('Please enter a clinical diagnosis', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      await recordsService.uploadRecord({
        title: `Clinical Diagnosis: ${diagnosis}`,
        category: 'Clinical',
        description: `${notes}. Recommended follow-up: ${followup}`,
        file: null,
      });

      showToast('Clinical diagnosis logged and anchored to patient record!', 'success');
      setDiagnosis('');
      setNotes('');
      setFollowup('');
      onClose();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to save diagnosis. Please try again.',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const patientOptions = [
    { value: '', label: 'Select Patient...' },
    ...patients.map((p) => ({ value: p.id, label: `${p.name} (${p.id})` })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Clinical Diagnosis"
      subtitle="Record official diagnosis and follow-up recommendations"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <Select
          label="Patient"
          value={patient}
          onChange={(e) => setPatient(e.target.value)}
          options={patientOptions}
          required
        />

        <Input
          label="Diagnosis Title / ICD-10 Code"
          placeholder="e.g. Mild Essential Hypertension (ICD-10 I10)"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          required
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[#47634C]">Clinical Examination Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter clinical examination notes and findings..."
            rows={3}
            className="medrynx-input"
            required
          />
        </div>

        <Input
          label="Recommended Follow-up"
          placeholder="e.g. Repeat 24-hr ambulatory blood pressure in 4 weeks"
          value={followup}
          onChange={(e) => setFollowup(e.target.value)}
          required
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSaving}>
            Save Diagnosis
          </Button>
        </div>
      </form>
    </Modal>
  );
};
