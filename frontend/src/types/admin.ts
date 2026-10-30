export interface PlatformStats {
  totalUsers: number;
  totalDoctors: number;
  patientsCount: number;
  accessRequestsCount: number;
  activeEmergenciesCount: number;
  completedEmergenciesToday: number;
  pendingReconciliationsCount: number;
  totalDisputesCount: number;
}

export interface DoctorVerification {
  id: string;
  doctorId: string;
  doctorName: string;
  specialization: string;
  hospital: string;
  licenseId: string;
  submittedAt: string;
  status: 'verified' | 'pending' | 'suspended';
}

export interface BlockchainMetrics {
  network: string;
  status: 'Connected' | 'Syncing' | 'Offline';
  contractDeployed: boolean;
  totalTransactions: number;
  totalEvents: number;
  lastBlockNumber: number;
  avgBlockTime: string;
  integrityVerificationRate: string;
}

export interface StorageMetrics {
  encryptedRecordsCount: number;
  storedFilesCount: number;
  hashAnchoringStatus: 'Operational' | 'Degraded' | 'Offline';
  storageHealthPercentage: number;
  totalStorageUsed: string;
}
