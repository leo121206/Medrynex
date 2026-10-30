import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { disputeService } from '../../services/dispute.service';
import { Dispute, DisputeReason } from '../../types/dispute';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { ApiStateWrapper } from '../../components/ui/ApiStateWrapper';
import { useNotification } from '../../context/NotificationContext';
import { useApiCall } from '../../hooks/useApiCall';
import { AlertTriangle, UploadCloud, CheckCircle2, FileText } from 'lucide-react';

export const DisputesPage: React.FC = () => {
  const { showToast } = useNotification();
  const location = useLocation();
  const locationState = location.state as { eventId?: string; doctorName?: string; hospital?: string } | null;

  const { data: disputes, loading, error, refetch } = useApiCall<Dispute[]>(
    () => disputeService.getDisputes(),
    []
  );
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(Boolean(locationState?.eventId));

  // Form fields
  const [eventId, setEventId] = useState(locationState?.eventId || '');
  const [doctorName, setDoctorName] = useState(locationState?.doctorName || '');
  const [hospital, setHospital] = useState(locationState?.hospital || '');
  const [reason, setReason] = useState<DisputeReason>('Incorrect emergency claim');
  const [details, setDetails] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<Dispute | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim()) {
      showToast('Please provide additional details regarding your dispute', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await disputeService.submitDispute({
        eventId,
        doctorName,
        hospital,
        reason,
        details,
        file,
      });
      setSubmissionResult(result);
      showToast('Dispute submitted successfully and linked to access event!', 'success');
      refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to submit dispute', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetModal = () => {
    setIsRaiseModalOpen(false);
    setSubmissionResult(null);
    setDetails('');
    setFile(null);
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#26352A]">Dispute Management</h2>
          <p className="text-xs text-[#66736A] mt-0.5">
            File formal disputes against unauthorized or improper break-glass emergency events.
          </p>
        </div>
        <Button variant="danger" icon={<AlertTriangle className="w-4 h-4" />} onClick={() => setIsRaiseModalOpen(true)}>
          + Raise a Dispute
        </Button>
      </div>

      <ApiStateWrapper
        loading={loading}
        error={error}
        isEmpty={!loading && !error && disputes.length === 0}
        emptyTitle="No disputes filed"
        emptyMessage="You have not filed any formal access disputes."
        onRetry={refetch}
        skeletonRows={3}
      >
        <div className="space-y-4">
          {disputes.map((d) => (
            <Card key={d.id} padding="lg" className="space-y-4 bg-white border-[#DDE5DA]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#DDE5DA] pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-[#26352A]">{d.id}</span>
                    <Badge variant="warning">{d.status}</Badge>
                  </div>
                  <p className="text-xs text-[#66736A] mt-0.5">
                    Linked Event: {d.eventId} • Filed on {d.createdAt}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <span className="text-[#66736A] block">Target Clinician</span>
                  <strong className="text-[#26352A]">{d.doctorName} ({d.hospital})</strong>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <span className="font-bold text-[#C85C5C] block">Dispute Reason: {d.reason}</span>
                <p className="p-3 bg-[#F8F3EA] rounded-xl text-[#26352A] border border-[#DDE5DA]">
                  {d.details}
                </p>
              </div>

              {d.attachedDocName && (
                <div className="flex items-center gap-2 text-xs text-[#47634C] bg-[#E7F0E4] p-2.5 rounded-xl border border-[#A8CBA0]/50">
                  <FileText className="w-4 h-4" />
                  <span>Attached Evidence: <strong>{d.attachedDocName}</strong></span>
                </div>
              )}
            </Card>
          ))}
        </div>
      </ApiStateWrapper>

      {/* Raise Dispute Modal */}
      <Modal
        isOpen={isRaiseModalOpen}
        onClose={resetModal}
        title="Raise a Dispute"
        subtitle="Report unauthorized access or improper emergency break-glass"
      >
        {submissionResult ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-14 h-14 bg-[#E7F0E4] rounded-full text-[#5F8D65] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#26352A]">✓ Dispute Submitted</h3>
              <p className="text-xs text-[#66736A] mt-1">
                Your dispute has been recorded and linked to the original access event.
              </p>
            </div>

            <div className="bg-[#F8F3EA] p-4 rounded-2xl border border-[#DDE5DA] text-xs text-left space-y-2">
              <div className="flex justify-between">
                <span className="text-[#66736A]">Dispute Tracking ID:</span>
                <strong className="text-[#47634C] font-mono text-sm">{submissionResult.id}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[#66736A]">Status:</span>
                <span className="font-bold text-[#D9A441]">Open / Under Investigation</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#66736A]">Linked Access Event:</span>
                <span>{submissionResult.eventId}</span>
              </div>
            </div>

            <Button variant="primary" className="w-full py-2.5" onClick={resetModal}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {locationState?.eventId ? (
              <div className="p-3 bg-[#F8F3EA] rounded-xl text-xs space-y-1 border border-[#DDE5DA]">
                <span className="text-[#66736A] block">Target Access Event:</span>
                <strong className="text-[#26352A] block">{eventId} — {doctorName} ({hospital})</strong>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  label="Target Access / Emergency Event ID"
                  placeholder="e.g. emg-101"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  required
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Doctor Name"
                    placeholder="e.g. Attending Physician"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    required
                  />
                  <Input
                    label="Hospital / Organization"
                    placeholder="e.g. Hospital Facility"
                    value={hospital}
                    onChange={(e) => setHospital(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <Select
              label="Dispute Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as DisputeReason)}
              options={[
                { value: 'Unauthorized access', label: 'Unauthorized access' },
                { value: 'Incorrect emergency claim', label: 'Incorrect emergency claim' },
                { value: 'Incorrect record accessed', label: 'Incorrect record accessed' },
                { value: 'Unexpected access duration', label: 'Unexpected access duration' },
                { value: 'Other', label: 'Other' },
              ]}
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#47634C]">Additional Details</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Explain why this access event was improper..."
                rows={4}
                className="medrynx-input"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#47634C]">Attach Supporting Document (Optional)</label>
              <div className="border border-dashed border-[#DDE5DA] p-4 rounded-xl text-center cursor-pointer hover:bg-[#F8F3EA]/50 relative">
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <UploadCloud className="w-6 h-6 text-[#47634C] mx-auto mb-1" />
                <span className="text-xs font-semibold text-[#26352A]">
                  {file ? file.name : 'Upload PDF or JPG evidence receipt'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={resetModal}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" isLoading={isSubmitting}>
                Submit Dispute
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
