import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { IStorageService, StorageResult } from './IStorageService';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export class LocalStorageAdapter implements IStorageService {
  private storageDir: string;
  private gatewayUrl: string;

  constructor(storageDir?: string, gatewayUrl?: string) {
    this.storageDir = storageDir || path.resolve(process.cwd(), '.ipfs_storage');
    this.gatewayUrl = (gatewayUrl || env.IPFS_GATEWAY_URL || 'https://ipfs.io/ipfs/').replace(/\/+$/, '') + '/';

    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Deterministically generates standard CIDv0 (Qm...) multihash from content
   */
  private generateCid(data: Buffer): string {
    const sha256 = crypto.createHash('sha256').update(data).digest();
    const multihash = Buffer.concat([Buffer.from([0x12, 0x20]), sha256]);
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let num = BigInt('0x' + multihash.toString('hex'));
    let encoded = '';
    while (num > 0n) {
      const remainder = Number(num % 58n);
      num = num / 58n;
      encoded = ALPHABET[remainder] + encoded;
    }
    return `Qm${encoded.slice(0, 44)}`;
  }

  public async upload(encryptedData: Buffer): Promise<StorageResult> {
    const cid = this.generateCid(encryptedData);
    const targetFile = path.join(this.storageDir, `${cid}.enc`);
    fs.writeFileSync(targetFile, encryptedData);

    logger.info(`Encrypted medical blob saved to content-addressed storage with CID: ${cid}`);

    return {
      cid,
      sizeBytes: encryptedData.length,
      gatewayUrl: `${this.gatewayUrl}${cid}`,
    };
  }

  public async retrieve(cid: string): Promise<Buffer> {
    const targetFile = path.join(this.storageDir, `${cid}.enc`);
    if (!fs.existsSync(targetFile)) {
      throw new Error(`Storage Error: File with CID '${cid}' not found in content-addressed storage`);
    }
    return fs.readFileSync(targetFile);
  }

  public async pin(cid: string): Promise<boolean> {
    const targetFile = path.join(this.storageDir, `${cid}.enc`);
    return fs.existsSync(targetFile);
  }

  public async unpin(cid: string): Promise<boolean> {
    const targetFile = path.join(this.storageDir, `${cid}.enc`);
    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
      return true;
    }
    return false;
  }

  public async healthCheck(): Promise<boolean> {
    return fs.existsSync(this.storageDir);
  }
}
