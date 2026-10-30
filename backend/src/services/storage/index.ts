import { IStorageService, StorageResult } from './IStorageService';
import { IpfsStorageAdapter } from './IpfsStorageAdapter';
import { LocalStorageAdapter } from './LocalStorageAdapter';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export * from './IStorageService';
export * from './IpfsStorageAdapter';
export * from './LocalStorageAdapter';

/**
 * Resilient Hybrid Storage Service
 * Attempts real IPFS node first; if unreachable, falls back to local content-addressed storage.
 */
export class HybridStorageService implements IStorageService {
  private ipfsAdapter: IpfsStorageAdapter;
  private localAdapter: LocalStorageAdapter;

  constructor() {
    this.ipfsAdapter = new IpfsStorageAdapter();
    this.localAdapter = new LocalStorageAdapter();
  }

  public async upload(encryptedData: Buffer): Promise<StorageResult> {
    if (!env.IPFS_MOCK_ENABLED) {
      try {
        return await this.ipfsAdapter.upload(encryptedData);
      } catch (err) {
        logger.warn('Real IPFS upload failed, seamlessly falling back to content-addressed local store', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return this.localAdapter.upload(encryptedData);
  }

  public async retrieve(cid: string): Promise<Buffer> {
    // Check local store first (faster & resilient)
    try {
      return await this.localAdapter.retrieve(cid);
    } catch {
      // If not in local store, fetch from IPFS node
      return await this.ipfsAdapter.retrieve(cid);
    }
  }

  public async pin(cid: string): Promise<boolean> {
    const pinnedLocally = await this.localAdapter.pin(cid);
    const pinnedIpfs = await this.ipfsAdapter.pin(cid);
    return pinnedLocally || pinnedIpfs;
  }

  public async unpin(cid: string): Promise<boolean> {
    const unpinnedLocally = await this.localAdapter.unpin(cid);
    const unpinnedIpfs = await this.ipfsAdapter.unpin(cid);
    return unpinnedLocally || unpinnedIpfs;
  }

  public async healthCheck(): Promise<boolean> {
    const ipfsOk = await this.ipfsAdapter.healthCheck();
    const localOk = await this.localAdapter.healthCheck();
    return ipfsOk || localOk;
  }

  public async checkIpfsHealth(): Promise<boolean> {
    return this.ipfsAdapter.healthCheck();
  }
}

export const defaultStorage = new HybridStorageService();
