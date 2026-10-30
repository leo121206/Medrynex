import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createTrustRelationship,
  getTrustRelationships,
  getTrustRelationshipById,
  acceptTrustRelationship,
  rejectTrustRelationship,
  revokeTrustRelationship,
} from '../services/relationship.service';
import { RelationshipType, RelationshipStatus, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../types/common.types';
import { store } from '../models/store';
import { requireAbac } from '../middleware/abacGuard';
import { ApiError } from '../utils/apiError';

describe('Trust & Relationship Subsystem Unit Tests', () => {
  const patientAlice: AuthenticatedUser = {
    id: 'user-alice-pt',
    email: 'alice@medrynx.org',
    role: UserRole.PATIENT,
    patientId: 'PT-ALICE',
    organizationId: 'org-hosp-001',
  };

  const patientBob: AuthenticatedUser = {
    id: 'user-bob-pt',
    email: 'bob@medrynx.org',
    role: UserRole.PATIENT,
    patientId: 'PT-BOB',
    organizationId: 'org-hosp-002',
  };

  const doctorDave: AuthenticatedUser = {
    id: 'user-dave-doc',
    email: 'dave@medrynx.org',
    role: UserRole.DOCTOR,
    doctorId: 'DOC-DAVE',
    hospital: 'ABC Hospital',
    organizationId: 'org-hosp-001',
  };

  const doctorEve: AuthenticatedUser = {
    id: 'user-eve-doc',
    email: 'eve@medrynx.org',
    role: UserRole.DOCTOR,
    doctorId: 'DOC-EVE',
    hospital: 'City Clinic',
    organizationId: 'org-hosp-002',
  };

  beforeEach(() => {
    // Clean and reset store relationships
    store.relationships = [];
  });

  describe('Relationship Creation & Validation', () => {
    it('should create a valid PATIENT_PROVIDER trust relationship in PENDING status', async () => {
      const rel = await createTrustRelationship(
        {
          relationshipType: RelationshipType.PATIENT_PROVIDER,
          targetId: doctorDave.id,
          notes: 'Consulting Cardiologist Affiliation',
          durationDays: 180,
        },
        patientAlice
      );

      expect(rel.id).toBeDefined();
      expect(rel.relationshipType).toBe(RelationshipType.PATIENT_PROVIDER);
      expect(rel.status).toBe(RelationshipStatus.PENDING);
      expect(rel.subjectId).toBe(patientAlice.id);
      expect(rel.targetId).toBe(doctorDave.id);
      expect(rel.expiresAt).toBeDefined();
    });

    it('should create a PATIENT_ORGANIZATION relationship', async () => {
      const rel = await createTrustRelationship(
        {
          relationshipType: RelationshipType.PATIENT_ORGANIZATION,
          targetId: 'org-hosp-001',
          notes: 'Registered Outpatient at Metro Clinic',
        },
        patientAlice
      );

      expect(rel.relationshipType).toBe(RelationshipType.PATIENT_ORGANIZATION);
      expect(rel.status).toBe(RelationshipStatus.PENDING);
      expect(rel.organizationId).toBe('org-hosp-001');
    });

    it('should prevent self-relationship establishment', async () => {
      await expect(
        createTrustRelationship(
          {
            relationshipType: RelationshipType.PATIENT_PROVIDER,
            targetId: patientAlice.id,
          },
          patientAlice
        )
      ).rejects.toThrow('A participant cannot create a trust relationship with themselves');
    });

    it('should prevent unauthorized role from creating PROVIDER_ORGANIZATION relationship', async () => {
      await expect(
        createTrustRelationship(
          {
            relationshipType: RelationshipType.PROVIDER_ORGANIZATION,
            targetId: 'org-hosp-001',
          },
          patientAlice // Patient cannot create provider-org affiliation
        )
      ).rejects.toThrow('Only clinical providers or organization administrators can establish');
    });

    it('should reject duplicate pending or active relationship between same participants', async () => {
      await createTrustRelationship(
        {
          relationshipType: RelationshipType.PATIENT_PROVIDER,
          targetId: doctorDave.id,
        },
        patientAlice
      );

      await expect(
        createTrustRelationship(
          {
            relationshipType: RelationshipType.PATIENT_PROVIDER,
            targetId: doctorDave.id,
          },
          patientAlice
        )
      ).rejects.toThrow('An active or pending trust relationship already exists');
    });
  });

  describe('Relationship Lifecycle State Transitions', () => {
    it('should transition from PENDING to ACTIVE upon recipient acceptance', async () => {
      const created = await createTrustRelationship(
        {
          relationshipType: RelationshipType.PATIENT_PROVIDER,
          targetId: doctorDave.id,
        },
        patientAlice
      );

      expect(created.status).toBe(RelationshipStatus.PENDING);

      // Target doctor accepts the relationship
      const accepted = await acceptTrustRelationship(created.id, doctorDave);
      expect(accepted.status).toBe(RelationshipStatus.ACTIVE);
      expect(accepted.onChainTxHash).toBeDefined();
    });

    it('should block non-target participant from accepting a relationship (403)', async () => {
      const created = await createTrustRelationship(
        {
          relationshipType: RelationshipType.PATIENT_PROVIDER,
          targetId: doctorDave.id,
        },
        patientAlice
      );

      // Third party (Eve) attempts to accept
      await expect(acceptTrustRelationship(created.id, doctorEve)).rejects.toThrow(
        /permission to view this trust relationship|Only the recipient participant/
      );
    });

    it('should transition from PENDING to REJECTED when target rejects', async () => {
      const created = await createTrustRelationship(
        {
          relationshipType: RelationshipType.PATIENT_PROVIDER,
          targetId: doctorDave.id,
        },
        patientAlice
      );

      const rejected = await rejectTrustRelationship(created.id, doctorDave);
      expect(rejected.status).toBe(RelationshipStatus.REJECTED);
    });

    it('should transition from ACTIVE to REVOKED when either participant revokes', async () => {
      const created = await createTrustRelationship(
        {
          relationshipType: RelationshipType.PATIENT_PROVIDER,
          targetId: doctorDave.id,
        },
        patientAlice
      );

      await acceptTrustRelationship(created.id, doctorDave);

      // Patient Alice revokes the active affiliation
      const revoked = await revokeTrustRelationship(created.id, patientAlice);
      expect(revoked.status).toBe(RelationshipStatus.REVOKED);
    });
  });

  describe('IDOR & Access Isolation', () => {
    it('should return relationships only for the authenticated participant', async () => {
      await createTrustRelationship(
        {
          relationshipType: RelationshipType.PATIENT_PROVIDER,
          targetId: doctorDave.id,
        },
        patientAlice
      );

      const aliceList = await getTrustRelationships(patientAlice);
      expect(aliceList.length).toBe(1);

      // Bob should see 0 relationships
      const bobList = await getTrustRelationships(patientBob);
      expect(bobList.length).toBe(0);
    });

    it('should block unauthorized third party from accessing relationship by ID (403)', async () => {
      const rel = await createTrustRelationship(
        {
          relationshipType: RelationshipType.PATIENT_PROVIDER,
          targetId: doctorDave.id,
        },
        patientAlice
      );

      // Bob attempts to view Alice & Dave's relationship
      await expect(getTrustRelationshipById(rel.id, patientBob)).rejects.toThrow(
        'You do not have permission to view this trust relationship'
      );
    });
  });

  describe('ABAC Integration & Consent Safeguards', () => {
    it('should ensure active relationship alone does NOT bypass mandatory consent (403)', async () => {
      // Establish ACTIVE relationship between Alice and Dave
      const rel = await createTrustRelationship(
        {
          relationshipType: RelationshipType.PATIENT_PROVIDER,
          targetId: doctorDave.id,
        },
        patientAlice
      );
      await acceptTrustRelationship(rel.id, doctorDave);

      const guard = requireAbac({
        action: 'READ',
        resourceType: 'RECORD',
        extractPatientId: () => patientAlice.id,
      });

      const req: any = {
        user: doctorDave,
        params: { id: 'rec-unconsented' },
      };
      const res: any = {};
      const next = vi.fn();

      // Dave attempts read without active consent grant
      await guard(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('Access denied by ABAC Policy Engine');
    });

    it('should reject access if trust relationship has been explicitly REVOKED (403)', async () => {
      // Seed a revoked relationship between Alice and Dave
      store.relationships.push({
        id: 'rel-revoked-test',
        relationshipType: RelationshipType.PATIENT_PROVIDER,
        status: RelationshipStatus.REVOKED,
        subjectId: patientAlice.id,
        targetUserId: doctorDave.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const guard = requireAbac({
        action: 'READ',
        resourceType: 'RECORD',
        extractPatientId: () => patientAlice.id,
      });

      const req: any = {
        user: doctorDave,
        params: { id: 'rec-test-1' },
      };
      const res: any = {};
      const next = vi.fn();

      await guard(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(403);
      expect(error.message).toContain('Trust relationship between patient and provider has been revoked');
    });
  });
});
