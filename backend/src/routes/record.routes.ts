import { Router } from 'express';
import {
  uploadRecord,
  getRecords,
  getRecordById,
  downloadRecord,
  uploadVersion,
  getVersions,
  getVersion,
  downloadVersion,
  deleteRecord,
  checkRecordIntegrity,
} from '../controllers/record.controller';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { upload } from '../middleware/upload';
import { requireAbac } from '../middleware/abacGuard';

const router = Router();

/**
 * @route   POST /api/v1/records
 * @desc    Upload, AES-256 encrypt, and anchor a medical record to IPFS
 * @access  Protected (Patients, Doctors, Admins)
 */
router.post(
  '/',
  authenticate,
  requireRole('PATIENT', 'DOCTOR', 'ADMIN'),
  upload.single('file'),
  uploadRecord
);

/**
 * @route   GET /api/v1/records
 * @desc    Get medical records list for authenticated user or filtered patient
 * @access  Protected
 */
router.get('/', authenticate, getRecords);

/**
 * @route   GET /api/v1/records/:id
 * @desc    Get medical record metadata by ID
 * @access  Protected
 */
router.get('/:id', authenticate, requireAbac({ action: 'READ', resourceType: 'RECORD' }), getRecordById);

/**
 * @route   GET /api/v1/records/:id/integrity
 * @desc    Verify cryptographic integrity (SHA-256 ciphertext hash vs stored & on-chain evidence)
 * @access  Protected
 */
router.get('/:id/integrity', authenticate, requireAbac({ action: 'READ', resourceType: 'RECORD' }), checkRecordIntegrity);
router.get('/:id/verify-integrity', authenticate, requireAbac({ action: 'READ', resourceType: 'RECORD' }), checkRecordIntegrity);

/**
 * @route   DELETE /api/v1/records/:id
 * @desc    Cryptographically shred and tombstone medical record (GDPR Right to Erasure)
 * @access  Protected (Owner patient or Admin)
 */
router.delete('/:id', authenticate, deleteRecord);

/**
 * @route   GET /api/v1/records/:id/download
 * @desc    Download and decrypt medical record with scope-bound consent check
 * @access  Protected (Authorized patient, doctor with grant, or admin)
 */
router.get('/:id/download', authenticate, requireAbac({ action: 'DOWNLOAD', resourceType: 'RECORD' }), downloadRecord);

/**
 * @route   POST /api/v1/records/:id/versions
 * @desc    Upload a new revision creating an immutable historical version
 * @access  Protected (Authorized patient, doctor, or admin)
 */
router.post(
  '/:id/versions',
  authenticate,
  requireRole('PATIENT', 'DOCTOR', 'ADMIN'),
  upload.single('file'),
  uploadVersion
);

/**
 * @route   GET /api/v1/records/:id/versions
 * @desc    Get version history and provenance for a medical record
 * @access  Protected
 */
router.get('/:id/versions', authenticate, requireAbac({ action: 'READ', resourceType: 'RECORD' }), getVersions);

/**
 * @route   GET /api/v1/records/:id/versions/:versionNumber
 * @desc    Get metadata for a specific record version
 * @access  Protected
 */
router.get('/:id/versions/:versionNumber', authenticate, requireAbac({ action: 'READ', resourceType: 'RECORD' }), getVersion);

/**
 * @route   GET /api/v1/records/:id/versions/:versionNumber/download
 * @desc    Download and decrypt a specific historical version
 * @access  Protected
 */
router.get(
  '/:id/versions/:versionNumber/download',
  authenticate,
  requireAbac({ action: 'DOWNLOAD', resourceType: 'RECORD' }),
  downloadVersion
);

export default router;
