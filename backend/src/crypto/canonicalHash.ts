import crypto from 'crypto';

/**
 * Standard Evidence Structure for Medrynx Blockchain Anchoring.
 */
export interface CanonicalEvidencePayload {
  evidenceType: string;
  entityType: string;
  entityId: string;
  subjectId?: string | null;
  patientId?: string | null;
  actorId: string;
  organizationId?: string | null;
  action: string;
  timestamp: string; // ISO 8601 string
  details?: Record<string, unknown> | null;
  previousEvidenceHash?: string | null;
}

/**
 * Recursively sorts all keys in an object to produce a deterministic representation.
 */
export function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, any> = {};

  for (const key of sortedKeys) {
    const val = obj[key];
    if (val !== undefined) {
      result[key] = sortObjectKeys(val);
    }
  }

  return result;
}

/**
 * Serializes a payload to a deterministic canonical JSON string.
 */
export function serializeCanonicalJson(payload: Record<string, any>): string {
  const sorted = sortObjectKeys(payload);
  return JSON.stringify(sorted);
}

/**
 * Computes a deterministic SHA-256 hash (hex string) of the canonical payload.
 */
export function computeCanonicalHash(payload: Record<string, any>): string {
  const canonicalJson = serializeCanonicalJson(payload);
  return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

/**
 * Computes a bytes32 format (0x-prefixed 64 hex chars) hash for Solidity contracts.
 */
export function computeCanonicalBytes32(payload: Record<string, any>): string {
  const hashHex = computeCanonicalHash(payload);
  return `0x${hashHex}`;
}

/**
 * Constructs a sanitized canonical evidence payload stripped of any sensitive PHI.
 */
export function buildCanonicalEvidencePayload(params: {
  evidenceType: string;
  entityType: string;
  entityId: string;
  subjectId?: string | null;
  patientId?: string | null;
  actorId: string;
  organizationId?: string | null;
  action: string;
  timestamp?: string | Date;
  details?: Record<string, unknown>;
  previousEvidenceHash?: string | null;
}): CanonicalEvidencePayload {
  const tsStr = params.timestamp instanceof Date
    ? params.timestamp.toISOString()
    : typeof params.timestamp === 'string'
      ? params.timestamp
      : new Date().toISOString();

  // Strip any accidental PHI from details
  const sanitizedDetails: Record<string, unknown> = {};
  if (params.details) {
    for (const [k, v] of Object.entries(params.details)) {
      // Exclude obvious plaintext PHI fields
      const lowerKey = k.toLowerCase();
      if (
        lowerKey.includes('name') ||
        lowerKey.includes('diagnosis') ||
        lowerKey.includes('note') ||
        lowerKey.includes('prescription') ||
        lowerKey.includes('summary') ||
        lowerKey.includes('treatment') ||
        lowerKey.includes('condition') ||
        lowerKey.includes('vital') ||
        lowerKey.includes('reportcontent') ||
        lowerKey.includes('key') ||
        lowerKey.includes('token') ||
        lowerKey.includes('password') ||
        lowerKey.includes('secret')
      ) {
        continue;
      }
      sanitizedDetails[k] = v;
    }
  }

  return {
    evidenceType: params.evidenceType,
    entityType: params.entityType,
    entityId: params.entityId,
    subjectId: params.subjectId || null,
    patientId: params.patientId || null,
    actorId: params.actorId,
    organizationId: params.organizationId || null,
    action: params.action,
    timestamp: tsStr,
    details: Object.keys(sanitizedDetails).length > 0 ? sanitizedDetails : null,
    previousEvidenceHash: params.previousEvidenceHash || null,
  };
}
