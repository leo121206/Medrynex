import { describe, it, expect } from 'vitest';
import { LocalKeyManagementService } from '../crypto/kms/LocalKeyManagementService';
import { encryptWithEnvelope, decryptWithEnvelope } from '../crypto/kms/envelopeEncryption';

describe('Envelope Encryption Engine & KMS', () => {
  const testKms = new LocalKeyManagementService('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

  it('should encrypt and decrypt arbitrary medical file buffer using envelope encryption', async () => {
    const medicalData = Buffer.from('CLINICAL LAB RESULT: Hemoglobin 14.2 g/dL, Platelets 250,000 /uL.', 'utf-8');

    const result = await encryptWithEnvelope(medicalData, testKms);

    expect(result.combinedBlob).toBeDefined();
    expect(result.wrappedDek).toBeDefined();
    expect(result.keyVersion).toBe(1);
    expect(result.sha256Hash).toBeDefined();
    expect(result.iv).toBeDefined();
    expect(result.authTag).toBeDefined();

    // Plaintext should NOT appear in ciphertext combinedBlob
    expect(result.combinedBlob.includes(medicalData)).toBe(false);

    // Decrypt using wrapped DEK and KMS
    const decrypted = await decryptWithEnvelope(result.combinedBlob, result.wrappedDek, result.keyVersion, testKms);
    expect(decrypted.toString('utf-8')).toBe(medicalData.toString('utf-8'));
  });

  it('should fail authentication if ciphertext combined blob is tampered', async () => {
    const medicalData = Buffer.from('Sensitive Psychiatric Evaluation Notes - Confidential', 'utf-8');
    const result = await encryptWithEnvelope(medicalData, testKms);

    // Tamper with one byte in the ciphertext payload
    const tamperedBlob = Buffer.from(result.combinedBlob);
    tamperedBlob[tamperedBlob.length - 1] ^= 0xff;

    await expect(
      decryptWithEnvelope(tamperedBlob, result.wrappedDek, result.keyVersion, testKms)
    ).rejects.toThrow();
  });

  it('should support Master Key Encryption Key (KEK) rotation without re-encrypting raw file blobs', async () => {
    const originalSecret = Buffer.from('ORIGINAL_KEK_MASTER_KEY_32BYTES!!', 'utf-8').toString('hex').slice(0, 64);
    const rotatedSecret = Buffer.from('ROTATED__KEK_MASTER_KEY_32BYTES!!', 'utf-8').toString('hex').slice(0, 64);

    const rotatingKms = new LocalKeyManagementService(originalSecret);
    const rawFile = Buffer.from('Chest X-Ray DICOM Header: Patient ID 88392, Clear Lungs', 'utf-8');

    // 1. Encrypt under version 1 KEK
    const encResult = await encryptWithEnvelope(rawFile, rotatingKms);
    expect(encResult.keyVersion).toBe(1);

    // 2. Rotate master KEK to version 2
    const newVersion = await rotatingKms.rotateKek(rotatedSecret);
    expect(newVersion).toBe(2);
    expect(rotatingKms.getActiveVersion()).toBe(2);

    // 3. Re-wrap DEK under new KEK version (file ciphertext itself remains untouched!)
    const rewrapped = await rotatingKms.rewrapDek(encResult.wrappedDek, 1, 2);
    expect(rewrapped.keyVersion).toBe(2);
    expect(rewrapped.wrappedDek).not.toBe(encResult.wrappedDek);

    // 4. Decrypt file using rewrapped DEK and rotated KEK
    const decrypted = await decryptWithEnvelope(encResult.combinedBlob, rewrapped.wrappedDek, 2, rotatingKms);
    expect(decrypted.toString('utf-8')).toBe(rawFile.toString('utf-8'));
  });
});
