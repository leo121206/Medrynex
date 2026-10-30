/**
 * Key Management Service (KMS) Abstraction Interface
 * Decouples cryptographic key protection from application business logic.
 * Designed to support Local KMS (dev), HashiCorp Vault, AWS KMS, Azure Key Vault, GCP Cloud KMS.
 */
export interface WrappedKeyResult {
  wrappedDek: string; // Base64-encoded encrypted DEK
  keyVersion: number;
  algorithm: string;
}

export interface IKeyManagementService {
  /**
   * Generates a cryptographically strong 256-bit ephemeral Data Encryption Key (DEK)
   */
  generateDek(): Buffer;

  /**
   * Encrypts/wraps an ephemeral DEK under the current Key Encryption Key (KEK)
   */
  wrapDek(dek: Buffer, targetKeyVersion?: number): Promise<WrappedKeyResult>;

  /**
   * Decrypts/unwraps an encrypted DEK using the specified KEK version
   */
  unwrapDek(wrappedDek: string, keyVersion: number): Promise<Buffer>;

  /**
   * Re-encrypts a wrapped DEK from an older KEK version to a newer KEK version
   */
  rewrapDek(wrappedDek: string, fromVersion: number, toVersion: number): Promise<WrappedKeyResult>;

  /**
   * Rotates the master KEK to a new version
   */
  rotateKek(newKekHex?: string): Promise<number>;

  /**
   * Returns current active KEK version
   */
  getActiveVersion(): number;
}
