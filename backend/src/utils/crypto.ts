import crypto from 'crypto';
import { env } from '../config/env';

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: string; // Hex IV
  authTag: string; // Hex auth tag
  combinedBlob: Buffer; // IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
}

/**
 * Derives a 32-byte (256-bit) encryption key from the configured AES secret
 */
const getDerivedKey = (secretKeyHex: string): Buffer => {
  if (secretKeyHex.length === 64) {
    return Buffer.from(secretKeyHex, 'hex');
  }
  return crypto.createHash('sha256').update(secretKeyHex).digest();
};

/**
 * Encrypts arbitrary buffer using AES-256-GCM (Galois/Counter Mode for authenticated encryption)
 */
export const encryptAes256Gcm = (
  plaintext: Buffer,
  secretKeyHex: string = env.AES_SECRET_KEY
): EncryptedPayload => {
  const key = getDerivedKey(secretKeyHex);
  const iv = crypto.randomBytes(12); // Standard 96-bit IV for GCM

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combined blob: IV (12 bytes) + Tag (16 bytes) + Ciphertext
  const combinedBlob = Buffer.concat([iv, authTag, ciphertext]);

  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    combinedBlob,
  };
};

/**
 * Decrypts a combined encrypted blob using AES-256-GCM
 */
export const decryptAes256Gcm = (
  combinedBlob: Buffer,
  secretKeyHex: string = env.AES_SECRET_KEY
): Buffer => {
  if (combinedBlob.length < 28) {
    throw new Error('Encrypted blob is too small to contain valid IV and AuthTag');
  }

  const key = getDerivedKey(secretKeyHex);
  const iv = combinedBlob.subarray(0, 12);
  const authTag = combinedBlob.subarray(12, 28);
  const ciphertext = combinedBlob.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

/**
 * Computes the SHA-256 hash of data (anchored on blockchain contracts)
 */
export const computeSha256 = (data: Buffer): string => {
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Re-export modern envelope encryption engine & KMS abstraction
export * from '../crypto/kms/IKeyManagementService';
export * from '../crypto/kms/LocalKeyManagementService';
export * from '../crypto/kms/envelopeEncryption';
