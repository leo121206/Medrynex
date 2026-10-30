import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { fhirService } from '../services/fhir.service';
import { RecordCategory, RecordFileType } from '@prisma/client';

describe('HL7 FHIR R4 Interoperability Layer', () => {
  it('GET /api/v1/fhir/metadata should return FHIR CapabilityStatement', async () => {
    const res = await request(app).get('/api/v1/fhir/metadata');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/fhir+json');
    expect(res.body).toMatchObject({
      resourceType: 'CapabilityStatement',
      fhirVersion: '4.0.1',
      kind: 'instance',
      status: 'active',
    });
    expect(res.body.rest[0].resource.some((r: any) => r.type === 'Patient')).toBe(true);
    expect(res.body.rest[0].resource.some((r: any) => r.type === 'DocumentReference')).toBe(true);
    expect(res.body.rest[0].resource.some((r: any) => r.type === 'Consent')).toBe(true);
  });

  it('toFhirPatient should produce valid FHIR R4 Patient schema', () => {
    const rawUser = {
      id: 'pt-001',
      patientId: 'PT-98234',
      name: 'Karna Sharma',
      email: 'karna@medrynx.org',
      isActive: true,
      updatedAt: new Date(),
    };

    const patient = fhirService.toFhirPatient(rawUser);

    expect(patient.resourceType).toBe('Patient');
    expect(patient.id).toBe('PT-98234');
    expect(patient.active).toBe(true);
    expect(Array.isArray(patient.identifier)).toBe(true);
    expect((patient.name as any[])[0].family).toBe('Sharma');
    expect((patient.telecom as any[])[0].value).toBe('karna@medrynx.org');
  });

  it('toFhirDocumentReference should include IPFS URI and SHA-256 integrity hash', () => {
    const rawRecord = {
      id: 'rec-1234',
      patientId: 'PT-98234',
      title: 'Chest Computed Tomography (CT)',
      category: RecordCategory.Imaging,
      fileType: RecordFileType.PDF,
      encryptedIpfsHash: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      recordDate: new Date(),
      createdAt: new Date(),
      issuingClinician: 'Dr. Jane Smith',
      issuingHospital: 'ABC Hospital',
    };

    const docRef = fhirService.toFhirDocumentReference(rawRecord);

    expect(docRef.resourceType).toBe('DocumentReference');
    expect(docRef.status).toBe('current');
    expect((docRef.content as any[])[0].attachment.url).toBe('ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco');
    expect((docRef.content as any[])[0].attachment.contentType).toBe('application/pdf');
    expect((docRef.content as any[])[0].attachment.hash).toBeDefined();
  });

  it('toFhirConsent should reflect scope, validity period, and active status', () => {
    const rawGrant = {
      id: 'grant-777',
      patientId: 'PT-98234',
      doctorId: 'doc-456',
      recordType: 'Laboratory',
      status: 'ACTIVE',
      grantedAt: new Date(),
      accessExpiry: new Date(Date.now() + 86400000), // +1 day
      createdAt: new Date(),
    };

    const consent = fhirService.toFhirConsent(rawGrant);

    expect(consent.resourceType).toBe('Consent');
    expect(consent.status).toBe('active');
    expect((consent.provision as any).type).toBe('permit');
    expect((consent.provision as any).period.end).toBeDefined();
  });
});
