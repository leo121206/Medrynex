import { Request, Response } from 'express';
import { store, InMemoryGrant } from '../models/store';
import { prisma, isDbConnected } from '../models/db';
import { ApiResponse } from '../utils/apiResponse';
import { blockchainService } from '../services/blockchain.service';

export const getPlatformStats = async (_req: Request, res: Response) => {
  if (isDbConnected) {
    try {
      const [
        totalUsers,
        totalDoctors,
        patientsCount,
        accessRequestsCount,
        activeEmergencies,
        totalEmergencies,
        pendingReconciliations,
        totalDisputes,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: 'DOCTOR' } }),
        prisma.user.count({ where: { role: 'PATIENT' } }),
        prisma.accessRequest.count(),
        prisma.emergencyEvent.count({ where: { autoRevokeTimestamp: { gt: new Date() } } }),
        prisma.emergencyEvent.count(),
        prisma.emergencyEvent.count({ where: { reconciliationStatus: 'PENDING' } }),
        prisma.dispute.count(),
      ]);

      return ApiResponse.success(
        res,
        {
          totalUsers,
          totalDoctors,
          patientsCount,
          accessRequestsCount,
          activeEmergenciesCount: activeEmergencies,
          completedEmergenciesToday: totalEmergencies,
          pendingReconciliationsCount: pendingReconciliations,
          totalDisputesCount: totalDisputes,
        },
        'Platform stats fetched successfully'
      );
    } catch {
      // Fallback to in-memory store if query fails
    }
  }

  const totalUsers = store.users.length;
  const totalDoctors = store.users.filter((u) => u.role === 'DOCTOR').length;
  const patientsCount = store.users.filter((u) => u.role === 'PATIENT').length;
  const accessRequestsCount = store.requests.length;
  const activeEmergencies = store.emergencies.filter((e) => new Date(e.autoRevokeTimestamp) > new Date()).length;
  const totalEmergencies = store.emergencies.length;
  const pendingReconciliations = store.emergencies.filter(
    (e) => e.reconciliationStatus === 'PENDING'
  ).length;
  const totalDisputes = store.disputes.length;

  return ApiResponse.success(
    res,
    {
      totalUsers,
      totalDoctors,
      patientsCount,
      accessRequestsCount,
      activeEmergenciesCount: activeEmergencies,
      completedEmergenciesToday: totalEmergencies,
      pendingReconciliationsCount: pendingReconciliations,
      totalDisputesCount: totalDisputes,
    },
    'Platform stats fetched successfully'
  );
};

export const getDoctorVerifications = async (_req: Request, res: Response) => {
  if (isDbConnected) {
    try {
      const dbDoctors = await prisma.user.findMany({
        where: { role: 'DOCTOR' },
        orderBy: { createdAt: 'desc' },
      });
      const doctors = dbDoctors.map((doc) => ({
        id: doc.id,
        doctorId: doc.doctorId || doc.id,
        doctorName: doc.name,
        licenseId: doc.licenseId || 'PENDING-VERIFICATION',
        hospital: doc.hospital || 'Not specified',
        specialization: doc.specialization || 'General Medicine',
        submittedAt: doc.createdAt ? new Date(doc.createdAt).toISOString().split('T')[0] : '',
        status: doc.verificationStatus ? doc.verificationStatus.toLowerCase() : 'verified',
      }));
      return ApiResponse.success(res, doctors, 'Doctor verifications fetched successfully');
    } catch {
      // Fallback
    }
  }

  const doctors = store.users
    .filter((u) => u.role === 'DOCTOR')
    .map((doc) => ({
      id: doc.id,
      doctorId: doc.doctorId || doc.id,
      doctorName: doc.name,
      licenseId: doc.licenseId || 'PENDING-VERIFICATION',
      hospital: doc.hospital || 'Not specified',
      specialization: doc.specialization || 'General Medicine',
      submittedAt: doc.createdAt ? new Date(doc.createdAt).toISOString().split('T')[0] : '',
      status: doc.verificationStatus ? doc.verificationStatus.toLowerCase() : 'verified',
    }));

  return ApiResponse.success(res, doctors, 'Doctor verifications fetched successfully');
};

export const toggleDoctorVerification = async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { status } = req.body;
  const mappedStatus = status === 'verified' ? 'VERIFIED' : status === 'suspended' ? 'SUSPENDED' : 'PENDING';

  if (isDbConnected) {
    try {
      const dbDoc = await prisma.user.findFirst({
        where: {
          role: 'DOCTOR',
          OR: [{ id }, { doctorId: id }],
        },
      });
      if (dbDoc) {
        const updated = await prisma.user.update({
          where: { id: dbDoc.id },
          data: { verificationStatus: mappedStatus },
        });
        return ApiResponse.success(res, updated, `Doctor status updated to ${status}`);
      }
    } catch {
      // Fallback
    }
  }

  const doctor = store.users.find(
    (u) => (u.id === id || u.doctorId === id) && u.role === 'DOCTOR'
  );

  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  doctor.verificationStatus = mappedStatus;

  return ApiResponse.success(res, doctor, `Doctor status updated to ${status}`);
};

export const getPatients = async (_req: Request, res: Response) => {
  if (isDbConnected) {
    try {
      const dbPatients = await prisma.user.findMany({
        where: { role: 'PATIENT' },
        include: {
          patientGrants: {
            where: { status: 'ACTIVE' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      const patients = dbPatients.map((p) => ({
        id: p.patientId || p.id,
        name: p.name,
        email: p.email,
        phone: p.phone || 'Not specified',
        bloodGroup: p.bloodGroup || '—',
        dob: p.dob || '—',
        regDate: p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-GB') : '—',
        activeConsents: p.patientGrants.length,
        lastActivity: p.lastLogin ? new Date(p.lastLogin).toLocaleDateString('en-GB') : '—',
        status: 'active',
      }));
      return ApiResponse.success(res, patients, 'Patients fetched successfully');
    } catch {
      // Fallback
    }
  }

  const patients = store.users
    .filter((u) => u.role === 'PATIENT')
    .map((p) => {
      const activeConsentsCount = store.grants.filter(
        (c: InMemoryGrant) => (c.patientId === p.id || c.patientId === p.patientId) && c.status === 'ACTIVE'
      ).length;
      return {
        id: p.patientId || p.id,
        name: p.name,
        email: p.email,
        phone: p.phone || 'Not specified',
        bloodGroup: p.bloodGroup || '—',
        dob: p.dob || '—',
        regDate: p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-GB') : '—',
        activeConsents: activeConsentsCount,
        lastActivity: '—',
        status: 'active',
      };
    });

  return ApiResponse.success(res, patients, 'Patients fetched successfully');
};

export const getBlockchainMetrics = async (_req: Request, res: Response) => {
  const liveStatus = await blockchainService.getLiveBlockchainStatus();
  let auditCount = store.auditLogs.length;
  if (isDbConnected) {
    try {
      auditCount = await prisma.auditLog.count();
    } catch {
      // ignore
    }
  }

  const metrics = {
    network: liveStatus.network,
    rpcUrl: liveStatus.rpcUrl,
    chainId: liveStatus.chainId,
    isConnected: liveStatus.isConnected,
    latestBlock: liveStatus.latestBlock,
    contractsDeployed: liveStatus.contractsDeployed,
    anchoredTransactionsCount: auditCount,
    eventsEmittedCount: auditCount,
    integrityRate: liveStatus.integrityRate,
  };

  return ApiResponse.success(res, metrics, 'Blockchain metrics fetched successfully');
};

export const getStorageMetrics = async (_req: Request, res: Response) => {
  let totalFiles = store.records.length;
  if (isDbConnected) {
    try {
      totalFiles = await prisma.recordMetadata.count({ where: { recordStatus: 'ACTIVE' } });
    } catch {
      // ignore
    }
  }
  const metrics = {
    encryptedRecordsCount: totalFiles,
    storedFilesCount: totalFiles,
    hashAnchoringStatus: 'Operational',
    storageHealthPercentage: 100,
    totalStorageUsed: `${(totalFiles * 1.0).toFixed(1)} MB`,
  };

  return ApiResponse.success(res, metrics, 'Storage metrics fetched successfully');
};

export const getAnomalies = async (_req: Request, res: Response) => {
  if (isDbConnected) {
    try {
      const dbRequests = await prisma.accessRequest.findMany({
        include: { doctor: true },
        orderBy: { requestedAt: 'desc' },
      });
      const anomalies = dbRequests.map((r) => ({
        id: r.id,
        patientId: r.patientId,
        doctorId: r.doctorId,
        doctorName: r.doctor?.name || 'Clinician',
        doctorSpecialty: r.doctor?.specialization || 'General Medicine',
        hospital: r.doctor?.hospital || 'Not specified',
        recordType: r.recordType,
        purpose: r.purpose,
        durationDays: r.durationDays,
        riskScore: r.anomalyScore,
        riskLevel: r.riskLevel,
        isFlagged: r.isFlagged,
        status: r.status,
        reasons: r.riskAssessment ? (r.riskAssessment as any).reasons || [] : [],
      }));
      return ApiResponse.success(res, anomalies, 'Anomalies fetched successfully');
    } catch {
      // Fallback
    }
  }

  const anomalies = store.requests.map((r) => ({
    id: r.id,
    patientId: r.patientId,
    doctorId: r.doctorId,
    doctorName: r.doctorName || 'Clinician',
    doctorSpecialty: r.doctorSpecialty || 'General Medicine',
    hospital: r.hospital || 'Not specified',
    recordType: r.recordType,
    purpose: r.purpose,
    durationDays: r.durationDays,
    riskScore: r.anomalyScore,
    riskLevel: r.riskLevel,
    isFlagged: r.isFlagged,
    status: r.status,
    reasons: r.riskAssessment ? (r.riskAssessment as any).reasons || [] : [],
  }));

  return ApiResponse.success(res, anomalies, 'Anomalies fetched successfully');
};
