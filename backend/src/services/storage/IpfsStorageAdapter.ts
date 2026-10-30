import { IStorageService, StorageResult } from './IStorageService';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export class IpfsStorageAdapter implements IStorageService {
  private apiUrl: string;
  private gatewayUrl: string;
  private authHeader?: string;

  constructor(apiUrl?: string, gatewayUrl?: string, projectId?: string, projectSecret?: string) {
    this.apiUrl = (apiUrl || env.IPFS_API_URL || 'http://127.0.0.1:5001').replace(/\/+$/, '');
    this.gatewayUrl = (gatewayUrl || env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs/').replace(/\/+$/, '') + '/';

    if (projectId && projectSecret) {
      this.authHeader = `Basic ${Buffer.from(`${projectId}:${projectSecret}`).toString('base64')}`;
    }
  }

  private getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (this.authHeader) {
      headers['Authorization'] = this.authHeader;
    }
    return headers;
  }

  public validateCid(cid: string): boolean {
    if (!cid || typeof cid !== 'string') return false;
    // Standard CIDv0 check (base58, starts with Qm, 46 characters)
    const isCidV0 = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid);
    // Standard CIDv1 check (base32, starts with bafy...)
    const isCidV1 = /^baf[a-z0-9]{56,}$/.test(cid);
    return isCidV0 || isCidV1;
  }

  public async upload(encryptedData: Buffer): Promise<StorageResult> {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([encryptedData]), 'ciphertext.enc');

      const response = await fetch(`${this.apiUrl}/api/v0/add?pin=true`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`IPFS node returned HTTP ${response.status}: ${await response.text()}`);
      }

      const result = (await response.json()) as { Hash: string; Size: string };
      logger.info(`Encrypted medical blob pinned to IPFS node with CID: ${result.Hash}`);

      return {
        cid: result.Hash,
        sizeBytes: Number(result.Size) || encryptedData.length,
        gatewayUrl: `${this.gatewayUrl}${result.Hash}`,
      };
    } catch (err) {
      logger.error('IPFS upload failed', { error: err instanceof Error ? err.message : String(err) });
      throw new Error(`Failed to upload encrypted blob to IPFS: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  public async retrieve(cid: string): Promise<Buffer> {
    if (!this.validateCid(cid)) {
      throw new Error(`Invalid IPFS CID format: '${cid}'`);
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/v0/cat?arg=${cid}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`IPFS cat failed with HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      logger.error(`Failed to retrieve CID ${cid} from IPFS`, { error: err instanceof Error ? err.message : String(err) });
      throw new Error(`IPFS retrieval error for CID '${cid}': ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  public async pin(cid: string): Promise<boolean> {
    if (!this.validateCid(cid)) return false;
    try {
      const res = await fetch(`${this.apiUrl}/api/v0/pin/add?arg=${cid}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async unpin(cid: string): Promise<boolean> {
    if (!this.validateCid(cid)) return false;
    try {
      const res = await fetch(`${this.apiUrl}/api/v0/pin/rm?arg=${cid}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.apiUrl}/api/v0/version`, {
        method: 'POST',
        headers: this.getHeaders(),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false;
    }
  }
}
