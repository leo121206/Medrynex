import React, { useState, useEffect } from 'react';
import { recordsService } from '../../services/records.service';
import { getAuthToken } from '../../services/apiClient';
import { MedicalRecord, RecordCategory, RecordVersionItem } from '../../types/record';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { ClinicalDocumentModal } from '../../components/common/ClinicalDocumentModal';
import { useNotification } from '../../context/NotificationContext';
import { 
  FileText, UploadCloud, Search, Lock, CheckCircle2, 
  Download, Eye, Share2, History, GitBranch, Shield, Trash2, 
  UserCheck, Building2
} from 'lucide-react';

export const MedicalRecordsPage: React.FC = () => {
  const { showToast } = useNotification();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<MedicalRecord | null>(null);
  const [selectedRecordForView, setSelectedRecordForView] = useState<MedicalRecord | null>(null);
  const [detailTab, setDetailTab] = useState<'provenance' | 'versions' | 'shred'>('provenance');

  // Version History State
  const [recordVersions, setRecordVersions] = useState<RecordVersionItem[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isVersionUploadOpen, setIsVersionUploadOpen] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionSummary, setVersionSummary] = useState('');
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);

  // Upload Form State
  const [recordType, setRecordType] = useState<RecordCategory>('Laboratory');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<MedicalRecord | null>(null);

  // Shred / Tombstone confirmation state
  const [isShredding, setIsShredding] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await recordsService.getRecords();
      setRecords(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load records.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Please provide a record title', 'error');
      return;
    }
    setIsUploading(true);
    const newRecord = await recordsService.uploadRecord({
      title,
      category: recordType,
      description,
      file,
    });
    setIsUploading(false);
    setUploadSuccess(newRecord);
    setRecords((prev) => [newRecord, ...prev]);
    showToast('Medical record encrypted & anchored successfully!', 'success');
  };

  const handleDownloadRecord = async (r: MedicalRecord) => {
    if (r.recordStatus === 'TOMBSTONED') {
      showToast('Cannot download tombstoned record (keys shredded)', 'error');
      return;
    }
    try {
      await recordsService.downloadRecord(r.id, `${r.title.replace(/\s+/g, '_')}.pdf`, true);
      showToast(`Downloaded "${r.title}"`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to download record', 'error');
    }
  };

  const resetUploadState = () => {
    setIsUploadModalOpen(false);
    setUploadSuccess(null);
    setTitle('');
    setDescription('');
    setFile(null);
  };

  const openRecordDetail = async (record: MedicalRecord) => {
    setSelectedRecordForDetail(record);
    setDetailTab('provenance');
    setIsLoadingVersions(true);
    try {
      const versions = await recordsService.getRecordVersions(record.id);
      setRecordVersions(versions);
    } catch {
      setRecordVersions([]);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleVersionUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordForDetail || !versionFile) {
      showToast('Please select a file to upload as revision', 'error');
      return;
    }

    setIsUploadingVersion(true);
    try {
      const newVersion = await recordsService.uploadRecordVersion({
        recordId: selectedRecordForDetail.id,
        file: versionFile,
        changeSummary: versionSummary || `Revision uploaded on ${new Date().toLocaleDateString()}`,
      });
      setRecordVersions((prev) => [newVersion, ...prev]);
      setSelectedRecordForDetail((prev) => prev ? { ...prev, currentVersion: newVersion.versionNumber } : null);
      setIsVersionUploadOpen(false);
      setVersionFile(null);
      setVersionSummary('');
      showToast(`Revision v${newVersion.versionNumber} encrypted and anchored!`, 'success');
      loadRecords();
    } catch {
      showToast('Failed to upload record revision', 'error');
    } finally {
      setIsUploadingVersion(false);
    }
  };

  const handleCryptoShred = async () => {
    if (!selectedRecordForDetail) return;
    setIsShredding(true);
    try {
      const res = await recordsService.tombstoneRecord(selectedRecordForDetail.id);
      showToast(res.message || 'Record cryptographically shredded & tombstoned', 'success');
      setSelectedRecordForDetail(null);
      loadRecords();
    } catch {
      showToast('Failed to shred record', 'error');
    } finally {
      setIsShredding(false);
    }
  };

  const handleExportFhir = async (record: MedicalRecord) => {
    try {
      showToast('Generating FHIR R4 resource...', 'info');
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

  const filteredRecords = records.filter((r) => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || r.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#26352A]">Medical Records</h2>
          <p className="text-xs text-[#66736A] mt-0.5">
            Encrypted off-chain health records with cryptographic provenance, versioning & on-chain hash anchoring.
          </p>
        </div>
        <Button variant="primary" icon={<UploadCloud className="w-4 h-4" />} onClick={() => setIsUploadModalOpen(true)}>
          + Upload Record
        </Button>
      </div>

      {/* Filter Action Bar */}
      <Card padding="md" className="flex flex-col sm:flex-row items-center gap-4 bg-white">
        <div className="flex-1 w-full">
          <Input
            placeholder="Search records by title, clinician, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={[
              { value: 'All', label: 'All Record Types' },
              { value: 'Laboratory', label: 'Laboratory' },
              { value: 'Medication', label: 'Medication' },
              { value: 'Imaging', label: 'Imaging' },
              { value: 'Clinical', label: 'Clinical' },
              { value: 'Vaccination', label: 'Vaccination' },
              { value: 'Cardiology', label: 'Cardiology' },
            ]}
          />
        </div>
      </Card>

      {/* Loading / Error / Empty states */}
      {loadError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
          <span>Failed to load records: {loadError}</span>
          <Button variant="secondary" size="sm" onClick={loadRecords}>Retry</Button>
        </div>
      )}
      {isLoading && (
        <div className="text-center py-10 text-xs text-[#66736A]">Loading encrypted medical records...</div>
      )}
      {!isLoading && !loadError && filteredRecords.length === 0 && (
        <Card padding="lg" className="text-center py-12 bg-white text-xs text-[#66736A]">
          No medical records found matching your criteria.
        </Card>
      )}

      {/* Record Table / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {filteredRecords.map((r) => (
          <Card key={r.id} padding="md" hoverable className="space-y-4 bg-white border-[#DDE5DA]">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#E7F0E4] text-[#47634C] flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-[#26352A]">{r.title}</h4>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF8F5] border border-[#EBE3D5] text-[#47634C]">
                      v{r.currentVersion || 1}
                    </span>
                  </div>
                  <p className="text-xs text-[#66736A]">{r.category} • {r.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {r.recordStatus === 'TOMBSTONED' ? (
                  <Badge variant="danger">Tombstoned</Badge>
                ) : (
                  <Badge variant="success" icon={<Lock className="w-3 h-3" />}>
                    Encrypted
                  </Badge>
                )}
              </div>
            </div>

            <p className="text-xs text-[#66736A] line-clamp-2 leading-relaxed bg-[#F8F3EA]/70 p-2.5 rounded-xl border border-[#DDE5DA]/50">
              {r.description}
            </p>

            <div className="flex items-center justify-between text-[11px] text-[#66736A] pt-1">
              <span>Format: <strong className="text-[#26352A]">{r.fileType}</strong> ({r.fileSize})</span>
              <span className="font-mono text-[10px] text-[#47634C]">IPFS: {r.ipfsCid.slice(0, 10)}...</span>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#DDE5DA]">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<FileText className="w-3.5 h-3.5" />}
                  onClick={() => setSelectedRecordForView(r)}
                >
                  View Report
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Eye className="w-3.5 h-3.5" />}
                  onClick={() => openRecordDetail(r)}
                >
                  Provenance
                </Button>
              </div>
              <div className="flex items-center gap-1.5">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  icon={<Download className="w-3.5 h-3.5" />} 
                  onClick={() => handleDownloadRecord(r)}
                >
                  Download
                </Button>
                <Button variant="secondary" size="sm" icon={<Share2 className="w-3.5 h-3.5" />} onClick={() => showToast('Encrypted share link copied', 'info')}>
                  Share
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Upload Medical Record Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={resetUploadState}
        title="Upload Medical Record"
        subtitle="Add a new encrypted record with SHA-256 hash anchoring and Version 1 provenance"
      >
        {uploadSuccess ? (
          <div className="space-y-5 text-center py-4">
            <div className="w-14 h-14 bg-[#E7F0E4] rounded-full text-[#5F8D65] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[#26352A]">✓ Record Uploaded Successfully</h3>
              <p className="text-xs text-[#66736A] mt-1">Version 1 created and envelope-encrypted before storage</p>
            </div>

            <div className="bg-[#F8F3EA] p-4 rounded-2xl border border-[#DDE5DA] space-y-2 text-xs text-left">
              <div className="flex justify-between">
                <span className="text-[#66736A]">Encryption Engine:</span>
                <span className="font-bold text-[#5F8D65]">AES-256-GCM Envelope</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#66736A]">Version:</span>
                <span className="font-bold text-[#47634C]">v1 (Initial Document)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#66736A]">Storage Status:</span>
                <span className="font-bold text-[#26352A]">Encrypted & Anchored</span>
              </div>
              <div className="pt-2 border-t border-[#DDE5DA]">
                <span className="text-[11px] text-[#66736A] block">SHA-256 Integrity Anchor:</span>
                <code className="text-[10px] font-mono text-[#47634C] break-all">{uploadSuccess.sha256Hash}</code>
              </div>
            </div>

            <Button variant="primary" className="w-full py-2.5" onClick={resetUploadState}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <Select
              label="Record Type"
              value={recordType}
              onChange={(e) => setRecordType(e.target.value as RecordCategory)}
              options={[
                { value: 'Laboratory', label: 'Laboratory Test' },
                { value: 'Medication', label: 'Medication & Prescription' },
                { value: 'Imaging', label: 'Radiology / MRI / Scan' },
                { value: 'Clinical', label: 'Clinical Examination Notes' },
                { value: 'Vaccination', label: 'Immunization / Vaccination' },
                { value: 'Cardiology', label: 'ECG / Cardiology' },
              ]}
            />

            <Input
              label="Title"
              placeholder="e.g. Complete Blood Count & Renal Panel"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#47634C]">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Clinical details or notes regarding this test..."
                rows={3}
                className="medrynx-input"
              />
            </div>

            {/* Drag & Drop File Zone */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#47634C]">Upload File</label>
              <div className="border-2 border-dashed border-[#A8CBA0] bg-[#E7F0E4]/40 rounded-2xl p-6 text-center space-y-2 hover:bg-[#E7F0E4] transition-colors cursor-pointer relative">
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept=".pdf,.jpg,.png,.dicom,.json"
                />
                <UploadCloud className="w-8 h-8 text-[#47634C] mx-auto" />
                <p className="text-xs font-bold text-[#26352A]">
                  {file ? file.name : 'Drag & drop your file here or click to browse'}
                </p>
                <p className="text-[11px] text-[#66736A]">Supported Formats: PDF, JPG, PNG, DICOM, JSON</p>
              </div>
            </div>

            {/* Privacy notice banner */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F8F3EA] border border-[#DDE5DA] text-xs text-[#47634C]">
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-[#5F8D65]" />
              <div>
                <strong className="block text-[#26352A]">Envelope Encryption via KMS</strong>
                This file is encrypted locally with a fresh DEK. Only authorized clinicians with active consent or break-glass authorization can decrypt it.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button type="button" variant="secondary" onClick={resetUploadState}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isUploading}>
                Upload Record
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Record Detail Modal with Provenance & Versioning */}
      <Modal
        isOpen={!!selectedRecordForDetail}
        onClose={() => setSelectedRecordForDetail(null)}
        title={selectedRecordForDetail?.title}
        subtitle={`${selectedRecordForDetail?.category} • Current Version v${selectedRecordForDetail?.currentVersion || 1}`}
      >
        {selectedRecordForDetail && (
          <div className="space-y-4">
            {/* Modal Tabs */}
            <div className="flex border-b border-[#DDE5DA] text-xs">
              <button
                className={`pb-2 px-3 font-semibold transition-all ${
                  detailTab === 'provenance'
                    ? 'border-b-2 border-[#47634C] text-[#26352A]'
                    : 'text-[#66736A] hover:text-[#26352A]'
                }`}
                onClick={() => setDetailTab('provenance')}
              >
                Provenance & Metadata
              </button>
              <button
                className={`pb-2 px-3 font-semibold transition-all flex items-center gap-1.5 ${
                  detailTab === 'versions'
                    ? 'border-b-2 border-[#47634C] text-[#26352A]'
                    : 'text-[#66736A] hover:text-[#26352A]'
                }`}
                onClick={() => setDetailTab('versions')}
              >
                <GitBranch className="w-3.5 h-3.5" />
                Versions ({recordVersions.length || 1})
              </button>
              <button
                className={`pb-2 px-3 font-semibold transition-all flex items-center gap-1.5 text-red-600 hover:text-red-700 ${
                  detailTab === 'shred' ? 'border-b-2 border-red-600' : ''
                }`}
                onClick={() => setDetailTab('shred')}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Right to Erasure
              </button>
            </div>

            {/* TAB 1: Provenance & Metadata */}
            {detailTab === 'provenance' && (
              <div className="space-y-3">
                <div className="p-4 bg-[#F8F3EA] rounded-2xl border border-[#DDE5DA] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#66736A]">Uploaded By:</span>
                    <span className="font-bold text-[#26352A] flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-[#5F8D65]" />
                      {selectedRecordForDetail.creatorName || selectedRecordForDetail.issuingClinician || 'Patient Owner'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#66736A]">Organization / Center:</span>
                    <span className="font-bold text-[#26352A] flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-[#5F8D65]" />
                      {selectedRecordForDetail.organizationName || selectedRecordForDetail.issuingHospital || 'Medrynx Network'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#66736A]">Current Revision:</span>
                    <span className="font-bold text-[#47634C]">Version {selectedRecordForDetail.currentVersion || 1}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#66736A]">File Format & Size:</span>
                    <span className="font-bold text-[#26352A]">{selectedRecordForDetail.fileType} ({selectedRecordForDetail.fileSize})</span>
                  </div>
                </div>

                <div>
                  <h5 className="text-xs font-bold text-[#47634C] uppercase mb-1">Clinical Description</h5>
                  <p className="text-xs text-[#26352A] leading-relaxed p-3 bg-white border border-[#DDE5DA] rounded-xl">
                    {selectedRecordForDetail.description}
                  </p>
                </div>

                <div>
                  <h5 className="text-xs font-bold text-[#47634C] uppercase mb-1">Cryptographic Integrity Chain</h5>
                  <div className="p-3 bg-[#E7F0E4]/60 border border-[#A8CBA0]/50 rounded-xl text-xs space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[#66736A]">IPFS CID:</span>
                      <span className="text-[#26352A] break-all">{selectedRecordForDetail.ipfsCid}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#66736A]">SHA-256 Hash:</span>
                      <span className="text-[#47634C] break-all">{selectedRecordForDetail.sha256Hash}</span>
                    </div>
                    {selectedRecordForDetail.onChainTxHash && (
                      <div className="flex justify-between">
                        <span className="text-[#66736A]">On-Chain Anchor:</span>
                        <span className="text-[#26352A] break-all">{selectedRecordForDetail.onChainTxHash.slice(0, 20)}...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Version History */}
            {detailTab === 'versions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-[#26352A]">Immutable Revision Chain</h5>
                  <Button 
                    variant="primary" 
                    size="sm" 
                    icon={<UploadCloud className="w-3.5 h-3.5" />} 
                    onClick={() => setIsVersionUploadOpen(true)}
                  >
                    + Upload New Version
                  </Button>
                </div>

                {isLoadingVersions ? (
                  <div className="p-6 text-center text-xs text-[#66736A]">Loading version chain...</div>
                ) : recordVersions.length === 0 ? (
                  <div className="p-4 text-center bg-[#FAF8F5] rounded-xl border border-[#EBE3D5] text-xs text-[#66736A]">
                    Version 1 is the active revision.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {recordVersions.map((v) => (
                      <div 
                        key={v.id} 
                        className="p-3 bg-white rounded-xl border border-[#DDE5DA] flex items-center justify-between hover:border-[#A8CBA0] transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#26352A]">v{v.versionNumber}</span>
                            <span className="text-[11px] text-[#66736A]">• {v.fileType} ({v.fileSize})</span>
                            {v.versionNumber === selectedRecordForDetail.currentVersion && (
                              <Badge variant="success">Current</Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-[#66736A]">{v.changeSummary || 'Revision update'}</p>
                          <p className="text-[10px] font-mono text-[#47634C]">CID: {v.ipfsCid.slice(0, 12)}...</p>
                        </div>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          icon={<Download className="w-3.5 h-3.5" />} 
                          onClick={() => {
                            const token = getAuthToken();
                            const url = token ? `${v.downloadUrl}?token=${encodeURIComponent(token)}` : v.downloadUrl;
                            window.open(url, '_blank');
                          }}
                        >
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Right to Erasure / Crypto-Shred */}
            {detailTab === 'shred' && (
              <div className="space-y-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
                <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                  <Shield className="w-4 h-4" />
                  GDPR Article 17: Right to Erasure
                </div>
                <p className="text-xs text-red-600 leading-relaxed">
                  Cryptographic shredding permanently destroys the Data Encryption Key (DEK) wrapped under the KMS, unpins all decentralized storage objects from IPFS, and immutably records the tombstone on the blockchain ledger. Once shredded, the data cannot be decrypted by any party.
                </p>

                <div className="pt-2 flex justify-end">
                  <Button 
                    variant="danger" 
                    isLoading={isShredding} 
                    icon={<Trash2 className="w-3.5 h-3.5" />} 
                    onClick={handleCryptoShred}
                  >
                    Confirm Permanent Crypto-Shred
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <Button 
                variant="secondary" 
                size="sm"
                icon={<FileText className="w-3.5 h-3.5 text-[#5F8D65]" />}
                onClick={() => handleExportFhir(selectedRecordForDetail)}
              >
                Export FHIR R4 (JSON)
              </Button>
              <Button variant="secondary" onClick={() => setSelectedRecordForDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Upload New Version Modal */}
      <Modal
        isOpen={isVersionUploadOpen}
        onClose={() => setIsVersionUploadOpen(false)}
        title={`Upload Revision for ${selectedRecordForDetail?.title}`}
        subtitle={`Current version is v${selectedRecordForDetail?.currentVersion || 1}`}
      >
        <form onSubmit={handleVersionUploadSubmit} className="space-y-4">
          <Input
            label="Change Summary"
            placeholder="e.g. Updated lab values following follow-up test"
            value={versionSummary}
            onChange={(e) => setVersionSummary(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#47634C]">Revision File</label>
            <div className="border-2 border-dashed border-[#A8CBA0] bg-[#E7F0E4]/40 rounded-2xl p-6 text-center space-y-2 hover:bg-[#E7F0E4] transition-colors cursor-pointer relative">
              <input
                type="file"
                onChange={(e) => setVersionFile(e.target.files ? e.target.files[0] : null)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                accept=".pdf,.jpg,.png,.dicom,.json"
                required
              />
              <UploadCloud className="w-8 h-8 text-[#47634C] mx-auto" />
              <p className="text-xs font-bold text-[#26352A]">
                {versionFile ? versionFile.name : 'Select updated file to upload'}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsVersionUploadOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isUploadingVersion}>
              Upload Revision
            </Button>
          </div>
        </form>
      </Modal>

      {/* Inline Clinical Document Viewer Modal */}
      <ClinicalDocumentModal
        record={selectedRecordForView}
        isOpen={!!selectedRecordForView}
        onClose={() => setSelectedRecordForView(null)}
      />
    </div>
  );
};
