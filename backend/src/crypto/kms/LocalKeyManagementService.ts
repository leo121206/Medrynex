import crypto from 'crypto';
import { IKeyManagementService, WrappedKeyResult } from './IKeyManagementService';
import { env } from '../../config/env';

/**
 * Local Enterprise Key Management Service (LocalKMS)
 * Implements envelope encryption using Master Key Encryption Keys (KEKs) with key versioning & rotation.
 * In production, this can be swapped with AWS KMS, HashiCorp Vault, or Azure Key Vault without altering domain logic.
 */
export class LocalKeyManagementService implements IKeyManagementService {
  private keyRing: Map<number, Buffer> = new Map();
  private activeVersion: number = 1;

  constructor(initialKekHex?: string) {
    const defaultKek = initialKekHex || env.AES_SECRET_KEY;
    if ((process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production') && process.env.STRICT_PROD_ENFORCE === 'true') {
      if (defaultKek === 'e4d909c290d0fb1ca068ffaddf22cbd0ffd83296c09dfb32525501869f06e0a3') {
        throw new Error('KMS Security Violation: Development placeholder KEK cannot be used in production environment');
      }
    }
    const derived = this.derive32ByteKey(defaultKek);
    this.keyRing.set(1, derived);
  }

  private derive32ByteKey(secret: string): Buffer {
    if (secret.length === 64) {
      return Buffer.from(secret, 'hex');
    }
    return crypto.createHash('sha256').update(secret).digest();
  }

  public generateDek(): Buffer {
    // Generate fresh 256-bit (32 bytes) cryptographically secure pseudorandom key
    return crypto.randomBytes(32);
  }

  public async wrapDek(dek: Buffer, targetKeyVersion?: number): Promise<WrappedKeyResult> {
    const version = targetKeyVersion || this.activeVersion;
    const kek = this.keyRing.get(version);

    if (!kek) {
      throw new Error(`KMS Error: Master KEK version ${version} not found in keyring`);
    }

    // Wrap DEK using AES-256-GCM with fresh 12-byte IV
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
    const encryptedDek = Buffer.concat([cipher.update(dek), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Wrapped payload: IV (12 bytes) + Tag (16 bytes) + Encrypted DEK (32 bytes) = 60 bytes
    const combinedWrapped = Buffer.concat([iv, tag, encryptedDek]);

    return {
      wrappedDek: combinedWrapped.toString('base64'),
      keyVersion: version,
      algorithm: 'AES-256-GCM/KEK-WRAP',
    };
  }

  public async unwrapDek(wrappedDekBase64: string, keyVersion: number): Promise<Buffer> {
    const kek = this.keyRing.get(keyVersion);
    if (!kek) {
      throw new Error(`KMS Error: KEK version ${keyVersion} not found for unwrapping`);
    }

    const combinedWrapped = Buffer.from(wrappedDekBase64, 'base64');
    if (combinedWrapped.length < 28) {
      throw new Error('KMS Error: Corrupted or truncated wrapped DEK payload');
    }

    const iv = combinedWrapped.subarray(0, 12);
    const tag = combinedWrapped.subarray(12, 28);
    const encryptedDek = combinedWrapped.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', kek, iv);
    decipher.setAuthTag(tag);

    try {
      const plaintextDek = Buffer.concat([decipher.update(encryptedDek), decipher.final()]);
      return plaintextDek;
    } catch {
      throw new Error('KMS Error: Failed to unwrap DEK. Master KEK authentication failed or payload corrupted.');
    }
  }

  public async rewrapDek(wrappedDek: string, fromVersion: number, toVersion: number): Promise<WrappedKeyResult> {
    const rawDek = await this.unwrapDek(wrappedDek, fromVersion);
    try {
      return await this.wrapDek(rawDek, toVersion);
    } finally {
      rawDek.fill(0);
    }
  }

  public async rotateKek(newKekHex?: string): Promise<number> {
    const nextVersion = this.activeVersion + 1;
    const newKek = newKekHex ? this.derive32ByteKey(newKekHex) : crypto.randomBytes(32);
    this.keyRing.set(nextVersion, newKek);
    this.activeVersion = nextVersion;
    return nextVersion;
  }

  public getActiveVersion(): number {
    return this.activeVersion;
  }
}

// Export global singleton instance
export const localKms = new LocalKeyManagementService();
