import { Request, Response, NextFunction } from 'express';
import { fhirService } from '../services/fhir.service';
import { AuthenticatedUser } from '../types/common.types';

export class FhirController {
  // CapabilityStatement / Conformance (publicly discoverable)
  public async getMetadata(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const capabilityStatement = fhirService.getCapabilityStatement();
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(capabilityStatement);
    } catch (err) {
      next(err);
    }
  }

  // 1. Patient
  public async getPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const user = (req as any).user as AuthenticatedUser;
      const patient = await fhirService.getPatientById(id, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(patient);
    } catch (err) {
      next(err);
    }
  }

  public async searchPatients(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const identifier = (req.query.identifier || req.query._id) as string | undefined;
      const user = (req as any).user as AuthenticatedUser;
      const bundle = await fhirService.searchPatients(identifier, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(bundle);
    } catch (err) {
      next(err);
    }
  }

  // 2. Practitioner
  public async getPractitioner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const practitioner = await fhirService.getPractitionerById(id);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(practitioner);
    } catch (err) {
      next(err);
    }
  }

  public async searchPractitioners(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const name = req.query.name as string | undefined;
      const identifier = req.query.identifier as string | undefined;
      const bundle = await fhirService.searchPractitioners(name, identifier);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(bundle);
    } catch (err) {
      next(err);
    }
  }

  // 3. Organization
  public async getOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const organization = await fhirService.getOrganizationById(id);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(organization);
    } catch (err) {
      next(err);
    }
  }

  public async searchOrganizations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const name = req.query.name as string | undefined;
      const bundle = await fhirService.searchOrganizations(name);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(bundle);
    } catch (err) {
      next(err);
    }
  }

  // 4. Encounter
  public async getEncounter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const user = (req as any).user as AuthenticatedUser;
      const encounter = await fhirService.getEncounterById(id, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(encounter);
    } catch (err) {
      next(err);
    }
  }

  public async searchEncounters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = (req.query.patient || req.query.patientId) as string | undefined;
      const user = (req as any).user as AuthenticatedUser;
      const bundle = await fhirService.searchEncounters(patientId, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(bundle);
    } catch (err) {
      next(err);
    }
  }

  // 5. Condition
  public async getCondition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const user = (req as any).user as AuthenticatedUser;
      const condition = await fhirService.getConditionById(id, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(condition);
    } catch (err) {
      next(err);
    }
  }

  public async searchConditions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = (req.query.patient || req.query.patientId) as string | undefined;
      const user = (req as any).user as AuthenticatedUser;
      const bundle = await fhirService.searchConditions(patientId, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(bundle);
    } catch (err) {
      next(err);
    }
  }

  // 6. Observation
  public async getObservation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const user = (req as any).user as AuthenticatedUser;
      const observation = await fhirService.getObservationById(id, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(observation);
    } catch (err) {
      next(err);
    }
  }

  public async searchObservations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = (req.query.patient || req.query.patientId) as string | undefined;
      const category = req.query.category as string | undefined;
      const date = req.query.date as string | undefined;
      const user = (req as any).user as AuthenticatedUser;
      const bundle = await fhirService.searchObservations({ patientId, category, date }, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(bundle);
    } catch (err) {
      next(err);
    }
  }

  // 7. DiagnosticReport
  public async getDiagnosticReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const user = (req as any).user as AuthenticatedUser;
      const report = await fhirService.getDiagnosticReportById(id, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(report);
    } catch (err) {
      next(err);
    }
  }

  public async searchDiagnosticReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = (req.query.patient || req.query.patientId) as string | undefined;
      const date = req.query.date as string | undefined;
      const user = (req as any).user as AuthenticatedUser;
      const bundle = await fhirService.searchDiagnosticReports({ patientId, date }, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(bundle);
    } catch (err) {
      next(err);
    }
  }

  // 8. MedicationRequest
  public async getMedicationRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const user = (req as any).user as AuthenticatedUser;
      const medReq = await fhirService.getMedicationRequestById(id, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(medReq);
    } catch (err) {
      next(err);
    }
  }

  public async searchMedicationRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = (req.query.patient || req.query.patientId) as string | undefined;
      const status = req.query.status as string | undefined;
      const user = (req as any).user as AuthenticatedUser;
      const bundle = await fhirService.searchMedicationRequests({ patientId, status }, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(bundle);
    } catch (err) {
      next(err);
    }
  }

  // 9. DocumentReference
  public async getDocumentReference(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const user = (req as any).user as AuthenticatedUser;
      const doc = await fhirService.getDocumentReferenceById(id, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(doc);
    } catch (err) {
      next(err);
    }
  }

  public async searchDocumentReferences(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = (req.query.patient || req.query.patientId) as string | undefined;
      const user = (req as any).user as AuthenticatedUser;
      const bundle = await fhirService.searchDocumentReferences(patientId, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(bundle);
    } catch (err) {
      next(err);
    }
  }

  // 10. Consent
  public async getConsent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const user = (req as any).user as AuthenticatedUser;
      const consent = await fhirService.getConsentById(id, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(consent);
    } catch (err) {
      next(err);
    }
  }

  public async searchConsents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = (req.query.patient || req.query.patientId) as string | undefined;
      const user = (req as any).user as AuthenticatedUser;
      const bundle = await fhirService.searchConsents(patientId, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(bundle);
    } catch (err) {
      next(err);
    }
  }

  // 11. AuditEvent
  public async getAuditEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const user = (req as any).user as AuthenticatedUser;
      const audit = await fhirService.getAuditEventById(id, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(audit);
    } catch (err) {
      next(err);
    }
  }

  public async searchAuditEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as any).user as AuthenticatedUser;
      const bundle = await fhirService.searchAuditEvents(user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      res.status(200).json(bundle);
    } catch (err) {
      next(err);
    }
  }

  // 12. Full Patient Export Collection
  public async exportPatientBundle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patientId = String(req.params.id);
      const user = (req as any).user as AuthenticatedUser;
      const result = await fhirService.exportPatientBundle(patientId, user);
      res.setHeader('Content-Type', 'application/fhir+json; charset=utf-8');
      if (result.onChainTxHash) {
        res.setHeader('X-Medrynx-Blockchain-TxHash', result.onChainTxHash);
      }
      res.setHeader('X-Medrynx-Evidence-Hash', result.evidenceHash);
      res.status(200).json(result.bundle);
    } catch (err) {
      next(err);
    }
  }
}

export const fhirController = new FhirController();
