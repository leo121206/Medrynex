import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createRelationship,
  getRelationships,
  getPatientDirectory,
  getDoctorsDirectory,
  evaluateTrust,
  getRelationshipById,
  acceptRelationship,
  transitionRelationship,
  rejectRelationship,
  revokeRelationship,
} from '../controllers/relationship.controller';

const router = Router();

/**
 * @route   POST /api/v1/relationships
 * @desc    Initiate a new healthcare trust relationship
 * @access  Protected
 */
router.post('/', authenticate, createRelationship);

/**
 * @route   GET /api/v1/relationships
 * @desc    List trust relationships for authenticated participant
 * @access  Protected
 */
router.get('/', authenticate, getRelationships);

/**
 * @route   GET /api/v1/relationships/patients
 * @desc    List patients with T0-T3 trust tier evaluation and available record categories for clinicians
 * @access  Protected (Clinicians & Admins)
 */
router.get('/patients', authenticate, getPatientDirectory);

/**
 * @route   GET /api/v1/relationships/doctors
 * @desc    List verified clinicians for patient consent granting & affiliations
 * @access  Protected
 */
router.get('/doctors', authenticate, getDoctorsDirectory);

/**
 * @route   GET /api/v1/relationships/evaluate/:patientId
 * @desc    Evaluate T0-T3 trust tier between patient and doctor
 * @access  Protected
 */
router.get('/evaluate/:patientId', authenticate, evaluateTrust);

/**
 * @route   GET /api/v1/relationships/:id
 * @desc    Get detailed trust relationship by ID
 * @access  Protected
 */
router.get('/:id', authenticate, getRelationshipById);

/**
 * @route   PATCH /api/v1/relationships/:id/accept
 * @desc    Accept and activate a pending trust relationship (T0 -> T1)
 * @access  Protected (Recipient / Target participant)
 */
router.patch('/:id/accept', authenticate, acceptRelationship);

/**
 * @route   PATCH /api/v1/relationships/:id/transition
 * @desc    Transition an active trust relationship between PATIENT_PROVIDER and PATIENT_CARE_TEAM
 * @access  Protected (Patient or Admin)
 */
router.patch('/:id/transition', authenticate, transitionRelationship);

/**
 * @route   PATCH /api/v1/relationships/:id/reject
 * @desc    Reject a pending trust relationship
 * @access  Protected (Recipient / Target participant)
 */
router.patch('/:id/reject', authenticate, rejectRelationship);

/**
 * @route   PATCH /api/v1/relationships/:id/revoke
 * @desc    Revoke an active trust relationship (Downgrade -> T0 and revoke active consents)
 * @access  Protected (Subject or Target participant)
 */
router.patch('/:id/revoke', authenticate, revokeRelationship);

export default router;

