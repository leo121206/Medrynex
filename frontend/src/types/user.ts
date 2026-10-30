export type UserRole = 'patient' | 'doctor' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
  lastLogin: string;
  securityStatus: {
    authentication: boolean;
    recordEncryption: boolean;
    accessMonitoring: boolean;
    auditLogging: boolean;
  };
}

export interface PatientUser extends User {
  role: 'patient';
  patientId: string;
  dob: string;
  gender: string;
  bloodGroup: string;
  allergiesCount: number;
  activeConsentsCount: number;
  totalRecordsCount: number;
}

export interface DoctorUser extends User {
  role: 'doctor';
  doctorId: string;
  licenseId: string;
  specialization: string;
  hospital: string;
  verificationStatus: 'verified' | 'pending' | 'rejected';
  activePatientsCount: number;
  authorizedRecordsCount: number;
}

export interface AdminUser extends User {
  role: 'admin';
  adminId: string;
  department: string;
  permissions: string[];
}
