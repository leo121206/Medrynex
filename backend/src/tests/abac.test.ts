import { describe, it, expect, vi } from 'vitest';
import { requireAbac } from '../middleware/abacGuard';
import { requireRole } from '../middleware/roleGuard';
import { UserRole } from '@prisma/client';
import { ApiError } from '../utils/apiError';
import { store } from '../models/store';

describe('RBAC: requireRole Middleware Unit Tests', () => {
  const createMockReqResNext = (user: any, params: any = {}, query: any = {}, body: any = {}) => {
    const req: any = { user, params, query, body };
    const res: any = {};
    const next = vi.fn();
    return { req, res, next };
  };

  it('should permit access when user has the required role', () => {
    const guard = requireRole(UserRole.DOCTOR, UserRole.ADMIN);
    const { req, res, next } = createMockReqResNext({ id: 'doc-1', role: UserRole.DOCTOR });
    guard(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should reject access with 403 when user lacks required role', () => {
    const guard = requireRole(UserRole.DOCTOR);
    const { req, res, next } = createMockReqResNext({ id: 'pt-1', role: UserRole.PATIENT });
    expect(() => guard(req, res, next)).toThrowError(ApiError);
    try {
      guard(req, res, next);
    } catch (e: any) {
      expect(e.statusCode).toBe(403);
    }
  });

  it('should reject unauthenticated request with 401 in requireRole', () => {
    const guard = requireRole(UserRole.PATIENT);
    const { req, res, next } = createMockReqResNext(null);
    expect(() => guard(req, res, next)).toThrowError(ApiError);
    try {
      guard(req, res, next);
    } catch (e: any) {
      expect(e.statusCode).toBe(401);
    }
  });

  it('should validate all 7 existing UserRole values in RBAC policies', () => {
    const allRoles: UserRole[] = [
      UserRole.PATIENT,
      UserRole.DOCTOR,
      UserRole.NURSE,
      UserRole.ORGANIZATION_ADMIN,
      UserRole.AUDITOR,
      UserRole.PLATFORM_ADMIN,
      UserRole.ADMIN,
    ];
    for (const role of allRoles) {
      const guard = requireRole(role);
      const { req, res, next } = createMockReqResNext({ id: `user-${role}`, role });
      guard(req, res, next);
      expect(next).toHaveBeenCalledWith();
    }
  });
});

describe('ABAC Policy Engine Unit Tests', () => {
  const createMockReqResNext = (user: any, params: any = {}, query: any = {}, body: any = {}) => {
    const req: any = {
      user,
      params,
      query,
      body,
    };
    const res: any = {};
    const next = vi.fn();
    return { req, res, next };
  };

  it('RULE 3: should permit patient to access their own resource', async () => {
    const guard = requireAbac({
      action: 'READ',
      resourceType: 'RECORD',
      extractPatientId: (req) => req.params.patientId,
    });

    const { req, res, next } = createMockReqResNext(
      { id: 'patient-123', role: UserRole.PATIENT, patientId: 'PT-123' },
      { patientId: 'patient-123' }
    );

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('RULE 3: should block patient from accessing another patient record (403)', async () => {
    const guard = requireAbac({
      action: 'READ',
      resourceType: 'RECORD',
      extractPatientId: (req) => req.params.patientId,
    });

    const { req, res, next } = createMockReqResNext(
      { id: 'patient-123', role: UserRole.PATIENT, patientId: 'PT-123' },
      { patientId: 'patient-999' }
    );

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(403);
  });

  it('RULE 3: should block patient trying to override with client-supplied patientId (IDOR defense)', async () => {
    const guard = requireAbac({
      action: 'READ',
      resourceType: 'RECORD',
      extractPatientId: (req) => req.query.patientId,
    });

    const { req, res, next } = createMockReqResNext(
      { id: 'patient-alice-id', role: UserRole.PATIENT, patientId: 'PT-ALICE' },
      {},
      { patientId: 'PT-BOB' }
    );

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(403);
    expect(error.message).toContain('Patients may only access their own protected health information');
  });

  it('RULE 1: should enforce least privilege and block platform admins from downloading clinical payloads', async () => {
    const guard = requireAbac({
      action: 'DOWNLOAD',
      resourceType: 'RECORD',
    });

    const { req, res, next } = createMockReqResNext(
      { id: 'admin-001', role: UserRole.PLATFORM_ADMIN }
    );

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(403);
  });

  it('RULE 1: should allow platform admin to view metadata and audit resources', async () => {
    const guard = requireAbac({
      action: 'READ',
      resourceType: 'RECORD',
    });

    const { req, res, next } = createMockReqResNext(
      { id: 'admin-001', role: UserRole.PLATFORM_ADMIN }
    );

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('RULE 2: should block organization admins from cross-tenant administrative actions', async () => {
    const guard = requireAbac({
      action: 'READ',
      resourceType: 'ORGANIZATION',
    });

    const { req, res, next } = createMockReqResNext(
      { id: 'org-adm-1', role: UserRole.ORGANIZATION_ADMIN, organizationId: 'org-hosp-001' },
      {},
      { organizationId: 'org-hosp-002' }
    );

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(403);
  });

  it('RULE 2: should block organization admin from clinical DOWNLOAD (403)', async () => {
    const guard = requireAbac({
      action: 'DOWNLOAD',
      resourceType: 'RECORD',
    });

    const { req, res, next } = createMockReqResNext(
      { id: 'org-admin-1', role: UserRole.ORGANIZATION_ADMIN, organizationId: 'org-1' }
    );

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(403);
    expect(error.message).toContain('Organization administrators cannot decrypt');
  });

  it('RULE 2b: should permit organization admins within their own organization tenant', async () => {
    const guard = requireAbac({
      action: 'READ',
      resourceType: 'ORGANIZATION',
    });

    const { req, res, next } = createMockReqResNext(
      { id: 'org-adm-1', role: UserRole.ORGANIZATION_ADMIN, organizationId: 'org-hosp-001' },
      {},
      { organizationId: 'org-hosp-001' }
    );

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('RULE 4: should reject doctor access to patient record without active consent or emergency authorization (403)', async () => {
    const guard = requireAbac({
      action: 'READ',
      resourceType: 'RECORD',
      extractPatientId: () => 'patient-target-001',
    });

    const { req, res, next } = createMockReqResNext(
      { id: 'doc-unconsented-999', role: UserRole.DOCTOR, doctorId: 'd-999' },
      { id: 'rec-target-001' }
    );

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(403);
    expect(error.message).toContain('Access denied by ABAC Policy Engine');
  });

  it('RULE 4: should permit doctor with active consent grant', async () => {
    const guard = requireAbac({
      action: 'READ',
      resourceType: 'RECORD',
      extractPatientId: () => 'usr-patient-001',
    });

    const { req, res, next } = createMockReqResNext(
      { id: 'usr-doctor-001', role: UserRole.DOCTOR, doctorId: 'usr-doctor-001' },
      { id: 'rec-101' }
    );

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('RULE 4: should permit nurse with active consent grant', async () => {
    const guard = requireAbac({
      action: 'READ',
      resourceType: 'RECORD',
      extractPatientId: () => 'usr-patient-001',
    });

    const { req, res, next } = createMockReqResNext(
      { id: 'usr-doctor-001', role: UserRole.NURSE, doctorId: 'usr-doctor-001' },
      { id: 'rec-101' }
    );

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('RULE 4: should reject nurse without active consent or emergency (403)', async () => {
    const guard = requireAbac({
      action: 'READ',
      resourceType: 'RECORD',
      extractPatientId: () => 'patient-target-002',
    });

    const { req, res, next } = createMockReqResNext(
      { id: 'nurse-unconsented-1', role: UserRole.NURSE },
      { id: 'rec-target-002' }
    );

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(403);
  });

  it('RULE 4: should permit doctor with active emergency break-glass', async () => {
    const activeEmergencyId = `emg-test-${Date.now()}`;
    store.emergencies.push({
      id: activeEmergencyId,
      patientId: 'patient-emer-001',
      patientName: 'Test Patient',
      doctorId: 'doc-emer-001',
      doctorName: 'Dr. Emergency',
      hospital: 'Emergency Hospital',
      verificationTier: 'PARTIAL' as any,
      recordsAccessed: ['Laboratory'],
      durationMinutes: 30,
      reason: 'Critical care needed',
      emergencyCode: 'CODE-BLUE',
      hospitalVerified: true,
      accessWindowStart: new Date(),
      autoRevokeTimestamp: new Date(Date.now() + 30 * 60 * 1000),
      reconciliationStatus: 'PENDING' as any,
      onChainTxHash: '0x123',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const guard = requireAbac({
      action: 'READ',
      resourceType: 'RECORD',
      extractPatientId: () => 'patient-emer-001',
    });

    const { req, res, next } = createMockReqResNext(
      { id: 'doc-emer-001', role: UserRole.DOCTOR, doctorId: 'doc-emer-001' },
      { id: 'rec-emer-001' }
    );

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('RULE 4: should reject doctor when emergency session has expired (403)', async () => {
    const expiredEmergencyId = `emg-test-exp-${Date.now()}`;
    store.emergencies.push({
      id: expiredEmergencyId,
      patientId: 'patient-emer-expired',
      patientName: 'Test Patient Expired',
      doctorId: 'doc-emer-expired',
      doctorName: 'Dr. Emergency Expired',
      hospital: 'Emergency Hospital',
      verificationTier: 'PARTIAL' as any,
      recordsAccessed: ['Laboratory'],
      durationMinutes: 30,
      reason: 'Expired session',
      emergencyCode: 'CODE-BLUE',
      hospitalVerified: true,
      accessWindowStart: new Date(Date.now() - 3600 * 1000 * 2),
      autoRevokeTimestamp: new Date(Date.now() - 3600 * 1000),
      reconciliationStatus: 'PENDING' as any,
      onChainTxHash: '0x123',
      createdAt: new Date(Date.now() - 3600 * 1000 * 2),
      updatedAt: new Date(Date.now() - 3600 * 1000 * 2),
    });

    const guard = requireAbac({
      action: 'READ',
      resourceType: 'RECORD',
      extractPatientId: () => 'patient-emer-expired',
    });

    const { req, res, next } = createMockReqResNext(
      { id: 'doc-emer-expired', role: UserRole.DOCTOR, doctorId: 'doc-emer-expired' },
      { id: 'rec-emer-expired' }
    );

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(403);
  });

  it('RULE 4c: should reject cross-organization doctor access without grant (403)', async () => {
    store.records.push({
      id: 'rec-cross-org-test',
      patientId: 'patient-cross-org-1',
      organizationId: 'org-hospital-B',
      title: 'Org B Record',
      category: 'Laboratory' as any,
      description: null,
      fileType: 'PDF' as any,
      fileSize: '1 MB',
      encryptedIpfsHash: 'QmTestCrossOrg',
      sha256Hash: 'hashCrossOrg',
      isEncrypted: true,
      storageStatus: 'ENCRYPTED_AND_ANCHORED' as any,
      recordDate: new Date(),
    });

    const guard = requireAbac({
      action: 'READ',
      resourceType: 'RECORD',
      extractResourceId: () => 'rec-cross-org-test',
    });

    const { req, res, next } = createMockReqResNext(
      { id: 'doc-org-A', role: UserRole.DOCTOR, doctorId: 'doc-org-A', organizationId: 'org-hospital-A' },
      { id: 'rec-cross-org-test' }
    );

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(403);
    expect(error.message).toContain('Cross-organization patient record access denied');
  });

  it('RULE 5: should reject unauthenticated requests before authorization policy evaluation (401)', async () => {
    const guard = requireAbac({
      action: 'READ',
      resourceType: 'RECORD',
    });

    const { req, res, next } = createMockReqResNext(null);

    await guard(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(401);
  });
});

