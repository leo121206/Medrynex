import { defaultStorage, StorageResult } from './storage';

export type IpfsUploadResult = StorageResult;

/**
 * Uploads an encrypted medical record file buffer to decentralized storage (real IPFS with resilient fallback)
 */
export const uploadToIpfs = async (encryptedData: Buffer): Promise<IpfsUploadResult> => {
  return defaultStorage.upload(encryptedData);
};

/**
 * Retrieves an encrypted blob from decentralized storage by CID
 */
export const fetchFromIpfs = async (cid: string): Promise<Buffer> => {
  return defaultStorage.retrieve(cid);
};

/**
 * Pins a CID in decentralized storage
 */
export const pinIpfsCid = async (cid: string): Promise<boolean> => {
  return defaultStorage.pin(cid);
};

/**
 * Unpins a CID (for right to erasure / crypto-shredding)
 */
export const unpinIpfsCid = async (cid: string): Promise<boolean> => {
  return defaultStorage.unpin(cid);
};

export * from './storage';
