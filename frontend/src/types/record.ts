export type RecordCategory = 
  | 'Laboratory' 
  | 'Medication' 
  | 'Imaging' 
  | 'Clinical' 
  | 'Vaccination' 
  | 'Genomic' 
  | 'Cardiology';

export type RecordFileType = 'PDF' | 'JPG' | 'PNG' | 'DICOM' | 'JSON';

export interface RecordVersionItem {
  id: string;
  recordId: string;
  versionNumber: number;
  title?: string;
  fileType: RecordFileType;
  fileSize: string;
  sha256Hash: string;
  ipfsCid: string;
  creatorId?: string;
  creatorName?: string;
  creatorRole?: string;
  organizationId?: string;
  organizationName?: string;
  changeSummary?: string;
  onChainTxHash?: string;
  createdAt: string;
  downloadUrl: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  category: RecordCategory;
  description: string;
  date: string;
  uploadedAt: string;
  isEncrypted: boolean;
  fileType: RecordFileType;
  fileSize: string;
  sha256Hash: string;
  storageStatus: 'Encrypted & Anchored' | 'Pending' | 'Archived';
  recordStatus?: 'ACTIVE' | 'SUPERSEDED' | 'TOMBSTONED' | string;
  currentVersion?: number;
  ipfsCid: string;
  issuingClinician?: string;
  issuingHospital?: string;
  creatorId?: string;
  creatorName?: string;
  creatorRole?: string;
  organizationName?: string;
  onChainTxHash?: string;
  onChainRecordId?: string;
  versions?: RecordVersionItem[];
  downloadUrl?: string;
}

export interface UploadRecordPayload {
  title: string;
  category: RecordCategory;
  description: string;
  file: File | null;
}

export interface UploadVersionPayload {
  recordId: string;
  file: File;
  changeSummary?: string;
}
