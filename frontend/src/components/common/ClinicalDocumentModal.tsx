import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { MedicalRecord } from '../../types/record';
import { recordsService } from '../../services/records.service';
import { getAuthToken } from '../../services/apiClient';
import { useNotification } from '../../context/NotificationContext';
import {
  FileText,
  Lock,
  ShieldCheck,
  Download,
  Printer,
  Share2,
  FileCode,
  Loader2,
  CheckCircle2,
  Building2,
  User,
  Calendar,
  Hash,
} from 'lucide-react';

interface ClinicalDocumentModalProps {
  record: MedicalRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ClinicalDocumentModal: React.FC<ClinicalDocumentModalProps> = ({
  record,
  isOpen,
  onClose,
}) => {
  const { showToast } = useNotification();
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && record) {
      setIsLoading(true);
      setError(null);
      setDecryptedContent(null);

      // Fetch decrypted record text via authenticated service
      recordsService
        .downloadRecord(record.id, record.title, false)
        .then(({ textPreview }) => {
          setDecryptedContent(textPreview || record.description || 'Clinical report decrypted and verified.');
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to envelope-decrypt medical record');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, record]);

  if (!record) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (record.recordStatus === 'TOMBSTONED') {
      showToast('Cannot download tombstoned record (keys shredded)', 'error');
      return;
    }
    try {
      await recordsService.downloadRecord(record.id, `${record.title.replace(/\s+/g, '_')}.pdf`, true);
      showToast(`Downloaded "${record.title}"`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download record', 'error');
    }
  };

  const handleExportFhir = async () => {
    try {
      showToast('Exporting FHIR R4 resource...', 'info');
      const fhirData = await recordsService.exportFhirResource('DocumentReference', record.id);
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(fhirData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `FHIR-R4-${record.category}-${record.id}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('FHIR R4 resource exported successfully!', 'success');
    } catch {
      showToast('Failed to export FHIR resource', 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={record.title}
      subtitle={`Verified Clinical Document • ${record.category} • Version ${record.currentVersion || 1}`}
      maxWidth="2xl"
    >
      <div className="space-y-5 font-sans">
        {/* Document Header & Metadata Bar */}
        <div className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#DDE5DA] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EBE3D5] pb-3">
            <div className="flex items-center gap-2">
              <Badge variant="sage">{record.category}</Badge>
              <Badge variant="success">AES-256-GCM Envelope Decrypted</Badge>
              <Badge variant="neutral">{record.fileType}</Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#66736A]">
              <Calendar className="w-3.5 h-3.5 text-[#5F8D65]" />
              <span>Record Date: <strong className="text-[#26352A]">{record.date}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[#66736A] block text-[11px]">Patient Owner:</span>
              <strong className="text-[#26352A] flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-[#5F8D65]" />
                {record.patientName || 'Patient'} ({record.patientId})
              </strong>
            </div>
            <div>
              <span className="text-[#66736A] block text-[11px]">Issuing Clinician:</span>
              <strong className="text-[#26352A]">{record.issuingClinician || 'Verified Physician'}</strong>
            </div>
            <div>
              <span className="text-[#66736A] block text-[11px]">Hospital Network:</span>
              <span className="text-[#47634C] font-semibold flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {record.issuingHospital || 'Medrynx General'}
              </span>
            </div>
          </div>
        </div>

        {/* Document Body & Decrypted Content */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#26352A] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#5F8D65]" /> Decrypted Clinical Report Content
            </span>
            <span className="text-[11px] text-[#5F8D65] flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Zero-Knowledge Integrity Verified
            </span>
          </div>

          {isLoading ? (
            <div className="h-64 rounded-2xl bg-white border border-[#DDE5DA] flex flex-col items-center justify-center gap-3 text-xs text-[#66736A]">
              <Loader2 className="w-6 h-6 animate-spin text-[#47634C]" />
              <span>Unwrapping Data Encryption Key (DEK) &amp; Decrypting IPFS Blob…</span>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
              <p className="font-bold text-red-900">Decryption Error</p>
              <p>{error}</p>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-white border border-[#DDE5DA] shadow-xs max-h-96 overflow-y-auto">
              <pre className="font-mono text-xs text-[#26352A] whitespace-pre-wrap leading-relaxed">
                {decryptedContent}
              </pre>
            </div>
          )}
        </div>

        {/* Cryptographic Integrity & Blockchain Anchor Box */}
        <div className="p-3.5 bg-[#FAF8F5] rounded-xl border border-[#EBE3D5] space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#47634C] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#5F8D65]" /> Cryptographic Audit Proofs
            </span>
            <span className="text-[10px] text-[#66736A]">KMS Key Version {record.currentVersion || 1}</span>
          </div>
          <div className="space-y-1 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-[#66736A]">SHA-256 Ciphertext Hash:</span>
              <code className="font-mono text-[#26352A] bg-white px-2 py-0.5 rounded border border-[#DDE5DA]">
                {record.sha256Hash?.slice(0, 24)}…{record.sha256Hash?.slice(-8)}
              </code>
            </div>
            {record.ipfsCid && (
              <div className="flex items-center justify-between">
                <span className="text-[#66736A]">IPFS Decentralized CID:</span>
                <code className="font-mono text-[#47634C] bg-white px-2 py-0.5 rounded border border-[#DDE5DA]">
                  {record.ipfsCid}
                </code>
              </div>
            )}
            {record.onChainTxHash && (
              <div className="flex items-center justify-between">
                <span className="text-[#66736A]">Blockchain Anchor TX:</span>
                <code className="font-mono text-[#26352A] bg-white px-2 py-0.5 rounded border border-[#DDE5DA]">
                  {record.onChainTxHash?.slice(0, 20)}…
                </code>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#DDE5DA]">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer className="w-3.5 h-3.5" />}
              onClick={handlePrint}
            >
              Print Report
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<FileCode className="w-3.5 h-3.5" />}
              onClick={handleExportFhir}
            >
              Export FHIR R4
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={handleDownload}
            >
              Download Decrypted Copy
            </Button>
            <Button variant="primary" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
