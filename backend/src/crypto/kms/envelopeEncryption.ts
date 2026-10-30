import crypto from 'crypto';
import { IKeyManagementService } from './IKeyManagementService';
import { localKms } from './LocalKeyManagementService';
import { getKmsProvider } from './kmsFactory';

export interface EnvelopeEncryptionResult {
  combinedBlob: Buffer; // IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
  wrappedDek: string; // Base64 wrapped DEK
  keyVersion: number; // KEK version used for wrapping
  iv: string; // Hex IV
  authTag: string; // Hex AuthTag
  sha256Hash: string; // SHA-256 hash of combinedBlob (for on-chain anchoring)
}

/**
 * Encrypts arbitrary medical file data using envelope encryption:
 * 1. Generates ephemeral 256-bit Data Encryption Key (DEK)
 * 2. Encrypts plaintext using AES-256-GCM(DEK)
 * 3. Wraps DEK using Master Key Encryption Key (KEK) via KMS
 * 4. Plaintext DEK is securely zeroed out from volatile memory
 */
export async function encryptWithEnvelope(
  plaintext: Buffer,
  kms: IKeyManagementService = getKmsProvider()
): Promise<EnvelopeEncryptionResult> {
  // 1. Generate ephemeral DEK
  const dek = kms.generateDek();

  try {
    // 2. Encrypt file data with DEK using AES-256-GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // 3. Combine blob: IV (12) + Tag (16) + Ciphertext
    const combinedBlob = Buffer.concat([iv, authTag, ciphertext]);

    // 4. Wrap DEK under current KEK
    const wrapResult = await kms.wrapDek(dek);

    // 5. Compute SHA-256 hash of the encrypted blob for blockchain anchoring
    const sha256Hash = crypto.createHash('sha256').update(combinedBlob).digest('hex');

    return {
      combinedBlob,
      wrappedDek: wrapResult.wrappedDek,
      keyVersion: wrapResult.keyVersion,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      sha256Hash,
    };
  } finally {
    // Zero out plaintext DEK in memory
    dek.fill(0);
  }
}

/**
 * Decrypts an envelope-encrypted medical file:
 * 1. Unwraps DEK using Master KEK via KMS
 * 2. Validates IV & AuthTag
 * 3. Decrypts and authenticates ciphertext using DEK
 * 4. Plaintext DEK is securely zeroed out
 */
export async function decryptWithEnvelope(
  combinedBlob: Buffer,
  wrappedDek: string,
  keyVersion: number,
  kms: IKeyManagementService = getKmsProvider()
): Promise<Buffer> {
  if (combinedBlob.length < 28) {
    throw new Error('Decryption Error: Encrypted blob is smaller than minimum header size (28 bytes)');
  }

  // 1. Unwrap DEK using KMS
  const dek = await kms.unwrapDek(wrappedDek, keyVersion);

  try {
    const iv = combinedBlob.subarray(0, 12);
    const authTag = combinedBlob.subarray(12, 28);
    const ciphertext = combinedBlob.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext;
  } finally {
    // Zero out unwrapped plaintext DEK
    dek.fill(0);
  }
}
