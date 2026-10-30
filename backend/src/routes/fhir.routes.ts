import { Router } from 'express';
import { fhirController } from '../controllers/fhir.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// CapabilityStatement / Conformance (publicly discoverable per FHIR specification)
router.get('/metadata', (req, res, next) => fhirController.getMetadata(req, res, next));

// All clinical FHIR Resource endpoints are strictly protected by authentication
router.use(authenticate);

// 1. Patient
router.get('/Patient', (req, res, next) => fhirController.searchPatients(req, res, next));
router.get('/Patient/:id', (req, res, next) => fhirController.getPatient(req, res, next));
router.get('/Patient/:id/\\$everything', (req, res, next) => fhirController.exportPatientBundle(req, res, next));

// 2. Practitioner
router.get('/Practitioner', (req, res, next) => fhirController.searchPractitioners(req, res, next));
router.get('/Practitioner/:id', (req, res, next) => fhirController.getPractitioner(req, res, next));

// 3. Organization
router.get('/Organization', (req, res, next) => fhirController.searchOrganizations(req, res, next));
router.get('/Organization/:id', (req, res, next) => fhirController.getOrganization(req, res, next));

// 4. Encounter
router.get('/Encounter', (req, res, next) => fhirController.searchEncounters(req, res, next));
router.get('/Encounter/:id', (req, res, next) => fhirController.getEncounter(req, res, next));

// 5. Condition
router.get('/Condition', (req, res, next) => fhirController.searchConditions(req, res, next));
router.get('/Condition/:id', (req, res, next) => fhirController.getCondition(req, res, next));

// 6. Observation
router.get('/Observation', (req, res, next) => fhirController.searchObservations(req, res, next));
router.get('/Observation/:id', (req, res, next) => fhirController.getObservation(req, res, next));

// 7. DiagnosticReport
router.get('/DiagnosticReport', (req, res, next) => fhirController.searchDiagnosticReports(req, res, next));
router.get('/DiagnosticReport/:id', (req, res, next) => fhirController.getDiagnosticReport(req, res, next));

// 8. MedicationRequest
router.get('/MedicationRequest', (req, res, next) => fhirController.searchMedicationRequests(req, res, next));
router.get('/MedicationRequest/:id', (req, res, next) => fhirController.getMedicationRequest(req, res, next));

// 9. DocumentReference
router.get('/DocumentReference', (req, res, next) => fhirController.searchDocumentReferences(req, res, next));
router.get('/DocumentReference/:id', (req, res, next) => fhirController.getDocumentReference(req, res, next));

// 10. Consent
router.get('/Consent', (req, res, next) => fhirController.searchConsents(req, res, next));
router.get('/Consent/:id', (req, res, next) => fhirController.getConsent(req, res, next));

// 11. AuditEvent
router.get('/AuditEvent', (req, res, next) => fhirController.searchAuditEvents(req, res, next));
router.get('/AuditEvent/:id', (req, res, next) => fhirController.getAuditEvent(req, res, next));

// 12. Full Patient Export Collection
router.get('/export/patient/:id', (req, res, next) => fhirController.exportPatientBundle(req, res, next));

export default router;
