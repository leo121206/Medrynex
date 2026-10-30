/**
 * Decentralized Encrypted File Storage Abstraction Interface
 * Decouples IPFS protocols and providers from healthcare business logic.
 */
export interface StorageResult {
  cid: string; // Content Identifier
  sizeBytes: number;
  gatewayUrl: string;
}

export interface IStorageService {
  /**
   * Uploads an authenticated encrypted ciphertext blob to decentralized storage
   */
  upload(encryptedData: Buffer): Promise<StorageResult>;

  /**
   * Retrieves an encrypted ciphertext blob by CID
   */
  retrieve(cid: string): Promise<Buffer>;

  /**
   * Pins an object to ensure persistent availability
   */
  pin(cid: string): Promise<boolean>;

  /**
   * Unpins an object (for GDPR right to erasure / crypto-shredding lifecycle)
   */
  unpin(cid: string): Promise<boolean>;

  /**
   * Checks connectivity and readiness of the underlying storage provider
   */
  healthCheck(): Promise<boolean>;
}
