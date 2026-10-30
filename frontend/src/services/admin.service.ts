/**
 * admin.service.ts — Real API integration only. No mock fallbacks.
 */
import { PlatformStats, DoctorVerification, BlockchainMetrics, StorageMetrics } from '../types/admin';
import { apiRequest } from './apiClient';

export interface AdminPatient {
  id: string;
  name: string;
  email: string;
  phone: string;
  bloodGroup: string;
  dob: string;
  regDate: string;
  activeConsents: number;
  lastActivity: string;
  status: string;
}

export interface AnomalyItem {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  hospital: string;
  recordType: string;
  purpose: string;
  durationDays: number;
  riskScore: number;
  riskLevel: string;
  isFlagged: boolean;
  status: string;
  reasons: string[];
}

export const adminService = {
  async getPlatformStats(): Promise<PlatformStats> {
    return apiRequest<PlatformStats>('/admin/stats');
  },

  async getDoctorVerifications(): Promise<DoctorVerification[]> {
    return apiRequest<DoctorVerification[]>('/admin/doctors');
  },

  async toggleDoctorStatus(doctorId: string, newStatus: 'verified' | 'pending' | 'suspended'): Promise<void> {
    await apiRequest(`/admin/doctors/${doctorId}/status`, {
      method: 'PATCH',
      data: { status: newStatus },
    });
  },

  async getPatients(): Promise<AdminPatient[]> {
    return apiRequest<AdminPatient[]>('/admin/patients');
  },

  async getAllUsers(): Promise<Array<{ id: string; name: string; role: string; hospital: string; status: string; email: string }>> {
    const result = await apiRequest<Array<Record<string, unknown>>>('/audit/users');
    return result.map((u) => ({
      id: u.id as string,
      name: u.name as string,
      role: u.role === 'DOCTOR' ? 'Doctor' : u.role === 'ADMIN' ? 'Super Admin' : 'Patient',
      hospital: (u.hospital as string) || '—',
      status: (u.verificationStatus === 'PENDING' ? 'Pending Verification' : 'Active'),
      email: u.email as string,
    }));
  },

  async getBlockchainMetrics(): Promise<BlockchainMetrics> {
    return apiRequest<BlockchainMetrics>('/admin/blockchain');
  },

  async getStorageMetrics(): Promise<StorageMetrics> {
    return apiRequest<StorageMetrics>('/admin/storage');
  },

  async getAnomalies(): Promise<AnomalyItem[]> {
    return apiRequest<AnomalyItem[]>('/admin/anomalies');
  },
};
