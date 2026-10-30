import {
  UserRole,
  DoctorVerificationStatus,
  RecordCategory,
  RecordFileType,
  StorageStatus,
  RequestPurpose,
  RiskLevel,
  RequestStatus,
  ConsentStatus,
  EmergencyAccessLevel,
  ReconciliationStatus,
  DisputeReason,
  DisputeStatus,
  AuditAccessType,
  AuditStatus,
  ActorRole,
  RelationshipType,
  RelationshipStatus,
} from '@prisma/client';

export interface InMemoryTrustRelationship {
  id: string;
  relationshipType: RelationshipType;
  status: RelationshipStatus;
  subjectId: string;
  targetUserId?: string | null;
  organizationId?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  expiresAt?: Date | null;
  onChainTxHash?: string | null;
  onChainId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryOrganization {
  id: string;
  name: string;
  code: string;
  type: string;
  address?: string | null;
  contactEmail?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  deviceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  isRevoked: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: Date;
}

export interface InMemoryUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  phone?: string | null;
  avatarUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date;
  organizationId?: string | null;
  patientId?: string | null;
  dob?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  doctorId?: string | null;
  licenseId?: string | null;
  specialization?: string | null;
  hospital?: string | null;
  verificationStatus?: DoctorVerificationStatus | null;
  adminId?: string | null;
  department?: string | null;
  permissions: string[];
}

export interface InMemoryRecord {
  id: string;
  patientId: string;
  organizationId?: string | null;
  title: string;
  category: RecordCategory;
  description: string | null;
  fileType: RecordFileType;
  fileSize: string;
  encryptedIpfsHash: string;
  sha256Hash: string;
  isEncrypted: boolean;
  storageStatus: StorageStatus;
  issuingClinician?: string | null;
  issuingHospital?: string | null;
  recordDate: Date;
  wrappedDek?: string | null;
  keyVersion?: number;
  encryptionAlgorithm?: string;
  iv?: string | null;
  authTag?: string | null;
  creatorId?: string | null;
  currentVersion?: number;
  recordStatus?: string;
  onChainTxHash?: string | null;
  onChainRecordId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryRecordVersion {
  id: string;
  recordId: string;
  versionNumber: number;
  title?: string | null;
  fileType: RecordFileType;
  fileSize: string;
  encryptedIpfsHash: string;
  sha256Hash: string;
  wrappedDek?: string | null;
  keyVersion?: number;
  encryptionAlgorithm?: string;
  iv?: string | null;
  authTag?: string | null;
  creatorId: string;
  creatorName?: string | null;
  creatorRole?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  changeSummary?: string | null;
  onChainTxHash?: string | null;
  createdAt: Date;
}

export interface InMemoryRequest {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName?: string;
  doctorSpecialty?: string;
  hospital?: string;
  recordType: string;
  purpose: RequestPurpose;
  durationDays: number;
  anomalyScore: number;
  riskLevel: RiskLevel;
  riskAssessment?: Record<string, unknown> | null;
  isFlagged: boolean;
  isBatched: boolean;
  batchGroupId?: string | null;
  status: RequestStatus;
  requestedAt: Date;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryGrant {
  id: string;
  requestId?: string | null;
  patientId: string;
  doctorId: string;
  doctorName?: string;
  doctorSpecialty?: string;
  hospital?: string;
  recordType: string;
  purpose: string;
  accessStart: Date;
  accessExpiry: Date;
  status: ConsentStatus;
  scopeNote?: string | null;
  onChainTxHash?: string | null;
  onChainGrantId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date | null;
}

export interface InMemoryBatch {
  id: string;
  patientId: string;
  title: string;
  description?: string | null;
  recordType: string;
  purpose: string;
  durationDays: number;
  riskLevel: string;
  status: string;
  doctors: Array<{ id: string; name: string; specialty: string; hospital: string }>;
  clinicians?: Array<{ id: string; name: string; specialty: string; hospital: string }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryEmergency {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId: string;
  doctorName?: string;
  hospital: string;
  verificationTier: EmergencyAccessLevel;
  recordsAccessed: string[];
  durationMinutes: number;
  reason: string;
  emergencyCode?: string | null;
  hospitalVerified: boolean;
  accessWindowStart: Date;
  autoRevokeTimestamp: Date;
  reconciliationStatus: ReconciliationStatus;
  onChainTxHash?: string | null;
  createdAt: Date;
  updatedAt: Date;
  patientHumanId?: string;
}

export interface InMemoryDispute {
  id: string;
  patientId: string;
  emergencyEventId: string;
  reason: DisputeReason;
  details: string;
  attachedDocName?: string | null;
  status: DisputeStatus;
  onChainTxHash?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryAuditLog {
  id: string;
  patientId?: string | null;
  actorId: string;
  actorName: string;
  actorRole: ActorRole;
  hospital?: string | null;
  recordType: string;
  purpose: string;
  accessType: AuditAccessType;
  status: AuditStatus;
  ipAddress?: string | null;
  txHash?: string | null;
  onChainEventName?: string | null;
  onChainBlockNumber?: bigint | null;
  details?: Record<string, unknown> | null;
  timestamp: Date;
}

class MedrynxDataStore {
  public organizations: InMemoryOrganization[] = [];
  public users: InMemoryUser[] = [];
  public records: InMemoryRecord[] = [];
  public requests: InMemoryRequest[] = [];
  public grants: InMemoryGrant[] = [];
  public batches: InMemoryBatch[] = [];
  public emergencies: InMemoryEmergency[] = [];
  public disputes: InMemoryDispute[] = [];
  public auditLogs: InMemoryAuditLog[] = [];
  public refreshTokens: InMemoryRefreshToken[] = [];
  public notifications: InMemoryNotification[] = [];
  public relationships: InMemoryTrustRelationship[] = [];
  public recordVersions: InMemoryRecordVersion[] = [];

  constructor() {
    if (process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)) {
      this.seedDefaults();
    }
  }

  public resetToTestDefaults() {
    this.seedDefaults();
  }

  private seedDefaults() {
    // 0. Multi-tenant Organizations
    this.organizations = [
      {
        id: 'org-hosp-001',
        name: 'ABC Hospital (Metro Health System)',
        code: 'HOSP-ABC',
        type: 'HOSPITAL',
        address: '100 Medical Center Way, Metro City',
        contactEmail: 'contact@abchospital.org',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'org-hosp-002',
        name: 'St. Jude Heart & Vascular Institute',
        code: 'HOSP-STJUDE',
        type: 'HOSPITAL',
        address: '250 Cardiovascular Blvd, Metro City',
        contactEmail: 'admissions@stjudeheart.org',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'org-lab-001',
        name: 'Apex Diagnostic & Genomic Pathology Lab',
        code: 'LAB-APEX',
        type: 'DIAGNOSTIC_LAB',
        address: '42 Genomic Research Park, Metro City',
        contactEmail: 'lab-director@apexpathology.org',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // 1. Users
    this.users = [
      {
        id: 'usr-patient-001',
        email: 'patient@medrynx.org',
        passwordHash: '$2b$10$BUZ3kfkB1AvEskN01rdFz.hDnvbxNvaGx1j5abVEsHO4YgB5mJULO', // Password123!
        name: 'Karna Sharma',
        role: UserRole.PATIENT,
        organizationId: 'org-hosp-001',
        phone: '+91 98765 43210',
        patientId: 'PT-98234',
        dob: '14 Mar 1988',
        gender: 'Male',
        bloodGroup: 'O+',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date(),
        permissions: ['READ_OWN', 'WRITE_OWN', 'GRANT_CONSENT'],
      },
      {
        id: 'usr-doctor-001',
        email: 'doctor@medrynx.org',
        passwordHash: '$2b$10$BUZ3kfkB1AvEskN01rdFz.hDnvbxNvaGx1j5abVEsHO4YgB5mJULO',
        name: 'Dr. Ananya Sharma',
        role: UserRole.DOCTOR,
        organizationId: 'org-hosp-001',
        phone: '+91 98111 22233',
        doctorId: 'd-201',
        licenseId: 'MCI-2019-94821',
        specialization: 'Cardiology',
        hospital: 'ABC Hospital',
        verificationStatus: DoctorVerificationStatus.VERIFIED,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date(),
        permissions: ['REQUEST_ACCESS', 'TRIGGER_EMERGENCY'],
      },
      {
        id: 'usr-doctor-002',
        email: 'priya.rao@medrynx.org',
        passwordHash: '$2b$10$BUZ3kfkB1AvEskN01rdFz.hDnvbxNvaGx1j5abVEsHO4YgB5mJULO',
        name: 'Dr. Priya Rao',
        role: UserRole.DOCTOR,
        organizationId: 'org-hosp-002',
        phone: '+91 98222 33344',
        doctorId: 'd-203',
        licenseId: 'MCI-2018-84729',
        specialization: 'Neurology',
        hospital: 'Care Hospital',
        verificationStatus: DoctorVerificationStatus.VERIFIED,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date(),
        permissions: ['REQUEST_ACCESS', 'TRIGGER_EMERGENCY'],
      },
      {
        id: 'usr-doctor-003',
        email: 'suresh.kumar@medrynx.org',
        passwordHash: '$2b$10$BUZ3kfkB1AvEskN01rdFz.hDnvbxNvaGx1j5abVEsHO4YgB5mJULO',
        name: 'Dr. Suresh Kumar',
        role: UserRole.DOCTOR,
        organizationId: 'org-hosp-001',
        phone: '+91 98333 44455',
        doctorId: 'd-204',
        licenseId: 'MCI-2015-38492',
        specialization: 'Emergency Medicine',
        hospital: 'ABC Hospital ER',
        verificationStatus: DoctorVerificationStatus.VERIFIED,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date(),
        permissions: ['REQUEST_ACCESS', 'TRIGGER_EMERGENCY'],
      },
      {
        id: 'usr-admin-001',
        email: 'admin@medrynx.org',
        passwordHash: '$2b$10$BUZ3kfkB1AvEskN01rdFz.hDnvbxNvaGx1j5abVEsHO4YgB5mJULO',
        name: 'Hospital Admin',
        role: UserRole.ADMIN,
        organizationId: 'org-hosp-001',
        phone: '+91 98444 55566',
        adminId: 'adm-101',
        department: 'EHR Compliance & Audit',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: new Date(),
        permissions: ['MANAGE_USERS', 'VIEW_AUDIT', 'OVERRIDE_ANOMALY'],
      },
    ];

    // 2. Records
    this.records = [
      {
        id: 'rec-101',
        patientId: 'usr-patient-001',
        title: 'Comprehensive Metabolic Panel (CMP)',
        category: RecordCategory.Laboratory,
        description: 'Complete blood chemistry panel including glucose, calcium, electrolytes, BUN, and creatinine.',
        fileType: RecordFileType.PDF,
        fileSize: '1.4 MB',
        encryptedIpfsHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
        sha256Hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        isEncrypted: true,
        storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
        issuingClinician: 'Dr. Priya Rao',
        issuingHospital: 'Care Hospital',
        recordDate: new Date('2026-09-10'),
        createdAt: new Date('2026-09-10'),
        updatedAt: new Date('2026-09-10'),
      },
      {
        id: 'rec-102',
        patientId: 'usr-patient-001',
        title: '12-Lead Resting Electrocardiogram (ECG)',
        category: RecordCategory.Cardiology,
        description: 'Standard 12-lead ECG tracing evaluating sinus rhythm and ST-segment profiles.',
        fileType: RecordFileType.PDF,
        fileSize: '2.1 MB',
        encryptedIpfsHash: 'QmZtmD2qt8STQgFSGLU54sQAvfL3hW6w4HhH8N2Vf2kG7v',
        sha256Hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
        isEncrypted: true,
        storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
        issuingClinician: 'Dr. Ananya Sharma',
        issuingHospital: 'ABC Hospital',
        recordDate: new Date('2026-09-12'),
        createdAt: new Date('2026-09-12'),
        updatedAt: new Date('2026-09-12'),
      },
      {
        id: 'rec-103',
        patientId: 'usr-patient-001',
        title: 'High-Resolution Brain MRI with Contrast',
        category: RecordCategory.Imaging,
        description: 'Axial, coronal, and sagittal T1/T2 weighted sequences of the cerebral cortex.',
        fileType: RecordFileType.DICOM,
        fileSize: '18.6 MB',
        encryptedIpfsHash: 'QmPZ9gcCEpqKTo6aq61g2nXGUhM49NY7ab5jCxxcnxnaPC',
        sha256Hash: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
        isEncrypted: true,
        storageStatus: StorageStatus.ENCRYPTED_AND_ANCHORED,
        issuingClinician: 'Dr. Priya Rao',
        issuingHospital: 'Care Hospital',
        recordDate: new Date('2026-09-08'),
        createdAt: new Date('2026-09-08'),
        updatedAt: new Date('2026-09-08'),
      },
    ];

    // 3. Requests
    this.requests = [
      {
        id: 'req-201',
        patientId: 'usr-patient-001',
        doctorId: 'usr-doctor-001',
        doctorName: 'Dr. Ananya Sharma',
        doctorSpecialty: 'Cardiology',
        hospital: 'ABC Hospital',
        recordType: '12-Lead Resting Electrocardiogram (ECG)',
        purpose: RequestPurpose.Diagnosis,
        durationDays: 7,
        anomalyScore: 18.5,
        riskLevel: RiskLevel.LOW,
        riskAssessment: {
          specialtyMatch: true,
          withinWorkingHours: true,
          networkAffiliated: true,
          explanation: 'Consistent with cardiologist evaluating cardiovascular telemetry.',
        },
        isFlagged: false,
        isBatched: false,
        status: RequestStatus.PENDING,
        requestedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'req-202',
        patientId: 'usr-patient-001',
        doctorId: 'usr-doctor-002',
        doctorName: 'Dr. Priya Rao',
        doctorSpecialty: 'Neurology',
        hospital: 'Care Hospital',
        recordType: 'Comprehensive Metabolic Panel (CMP)',
        purpose: RequestPurpose.Second_Opinion,
        durationDays: 14,
        anomalyScore: 78.2,
        riskLevel: RiskLevel.HIGH,
        riskAssessment: {
          specialtyMatch: false,
          withinWorkingHours: false,
          networkAffiliated: true,
          explanation: 'Off-hours request from Neurology requesting unrelated general metabolic records.',
        },
        isFlagged: true,
        isBatched: false,
        status: RequestStatus.PENDING,
        requestedAt: new Date(Date.now() - 3600 * 1000 * 3),
        createdAt: new Date(Date.now() - 3600 * 1000 * 3),
        updatedAt: new Date(Date.now() - 3600 * 1000 * 3),
      },
    ];

    // 4. Grants
    this.grants = [
      {
        id: 'grnt-301',
        patientId: 'usr-patient-001',
        doctorId: 'usr-doctor-001',
        doctorName: 'Dr. Ananya Sharma',
        doctorSpecialty: 'Cardiology',
        hospital: 'ABC Hospital',
        recordType: 'Cardiology',
        purpose: 'Cardiology evaluation and ongoing care plan',
        accessStart: new Date('2026-09-12'),
        accessExpiry: new Date(Date.now() + 86400 * 1000 * 5), // 5 days remaining
        status: ConsentStatus.ACTIVE,
        scopeNote: 'Granted exclusively for ECG and cardiovascular metrics.',
        onChainTxHash: '0x8f192b49c71a39f60d0341ea41203b5847e92314a51e6047291823efca481023',
        onChainGrantId: 'grant-evm-001',
        createdAt: new Date('2026-09-12'),
        updatedAt: new Date('2026-09-12'),
      },
      {
        id: 'grnt-302',
        patientId: 'usr-patient-001',
        doctorId: 'usr-doctor-001',
        doctorName: 'Dr. Ananya Sharma',
        doctorSpecialty: 'Cardiology',
        hospital: 'ABC Hospital',
        recordType: 'Laboratory',
        purpose: 'Comprehensive diagnostic evaluation',
        accessStart: new Date('2026-09-12'),
        accessExpiry: new Date(Date.now() + 86400 * 1000 * 5),
        status: ConsentStatus.ACTIVE,
        scopeNote: 'Granted for laboratory test results.',
        onChainTxHash: '0x8f192b49c71a39f60d0341ea41203b5847e92314a51e6047291823efca481024',
        onChainGrantId: 'grant-evm-002',
        createdAt: new Date('2026-09-12'),
        updatedAt: new Date('2026-09-12'),
      },
    ];

    // 5. Consent Batches
    this.batches = [
      {
        id: 'batch-401',
        patientId: 'usr-patient-001',
        title: 'ABC Hospital Outpatient Cardiology Care Team',
        description: 'Aggregated low-risk requests from verified attending physician and lab pathologist.',
        recordType: 'Laboratory & Cardiology',
        purpose: 'Routine Follow-up',
        durationDays: 14,
        riskLevel: 'Low',
        status: 'PENDING',
        doctors: [
          { id: 'usr-doctor-001', name: 'Dr. Ananya Sharma', specialty: 'Cardiology', hospital: 'ABC Hospital' },
          { id: 'usr-doctor-003', name: 'Dr. Suresh Kumar', specialty: 'Emergency Medicine', hospital: 'ABC Hospital ER' },
        ],
        clinicians: [
          { id: 'usr-doctor-001', name: 'Dr. Ananya Sharma', specialty: 'Cardiology', hospital: 'ABC Hospital' },
          { id: 'usr-doctor-003', name: 'Dr. Suresh Kumar', specialty: 'Emergency Medicine', hospital: 'ABC Hospital ER' },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // 6. Emergency Events
    this.emergencies = [
      {
        id: 'emg-501',
        patientId: 'usr-patient-001',
        patientName: 'Karna Sharma',
        doctorId: 'usr-doctor-003',
        doctorName: 'Dr. Suresh Kumar',
        hospital: 'ABC Hospital ER',
        verificationTier: EmergencyAccessLevel.PARTIAL,
        recordsAccessed: ['Medication', 'Laboratory'],
        durationMinutes: 15,
        reason: 'Acute anaphylactic reaction upon arrival; vital allergies checked.',
        emergencyCode: 'EMG-TRAUMA-CODE-RED',
        hospitalVerified: true,
        accessWindowStart: new Date(Date.now() - 3600 * 1000 * 48),
        autoRevokeTimestamp: new Date(Date.now() - 3600 * 1000 * 48 + 15 * 60 * 1000),
        reconciliationStatus: ReconciliationStatus.PENDING,
        onChainTxHash: '0x3a9921f00821bca9082341ef902148123901bca9928172645812903487123901',
        createdAt: new Date(Date.now() - 3600 * 1000 * 48),
        updatedAt: new Date(Date.now() - 3600 * 1000 * 48),
      },
    ];

    // 7. Audit Logs
    this.auditLogs = [
      {
        id: 'aud-001',
        patientId: 'usr-patient-001',
        actorId: 'usr-doctor-001',
        actorName: 'Dr. Ananya Sharma',
        actorRole: ActorRole.DOCTOR,
        hospital: 'ABC Hospital',
        recordType: 'Cardiology',
        purpose: 'Diagnosis',
        accessType: AuditAccessType.NORMAL,
        status: AuditStatus.COMPLETED,
        txHash: '0x8f192b49c71a39f60d0341ea41203b5847e92314a51e6047291823efca481023',
        timestamp: new Date(Date.now() - 3600 * 1000 * 24),
      },
      {
        id: 'aud-002',
        patientId: 'usr-patient-001',
        actorId: 'usr-doctor-003',
        actorName: 'Dr. Suresh Kumar',
        actorRole: ActorRole.DOCTOR,
        hospital: 'ABC Hospital ER',
        recordType: 'Medication, Laboratory',
        purpose: 'Emergency Treatment',
        accessType: AuditAccessType.EMERGENCY,
        status: AuditStatus.REVIEW_REQUIRED,
        txHash: '0x3a9921f00821bca9082341ef902148123901bca9928172645812903487123901',
        timestamp: new Date(Date.now() - 3600 * 1000 * 48),
      },
    ];

    // 8. Trust & Provider Relationships
    this.relationships = [
      {
        id: 'rel-101',
        relationshipType: RelationshipType.PATIENT_PROVIDER,
        status: RelationshipStatus.ACTIVE,
        subjectId: 'usr-patient-001',
        targetUserId: 'usr-doctor-001',
        organizationId: 'org-hosp-001',
        notes: 'Primary Attending Cardiologist',
        metadata: { department: 'Cardiology', hospital: 'ABC Hospital' },
        expiresAt: new Date(Date.now() + 365 * 86400 * 1000),
        onChainTxHash: '0xrel101hash',
        onChainId: 'rel-001',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rel-102',
        relationshipType: RelationshipType.PATIENT_ORGANIZATION,
        status: RelationshipStatus.ACTIVE,
        subjectId: 'usr-patient-001',
        targetUserId: null,
        organizationId: 'org-hosp-001',
        notes: 'Primary Care Facility Registration',
        metadata: { enrolledDepartment: 'General Outpatient' },
        expiresAt: null,
        onChainTxHash: '0xrel102hash',
        onChainId: 'rel-002',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }
}

export const store = new MedrynxDataStore();
