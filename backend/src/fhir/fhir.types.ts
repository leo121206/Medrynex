/**
 * HL7 FHIR R4 (v4.0.1) Type Definitions for Medrynx Healthcare Interoperability.
 * Conforms strictly to HL7 FHIR standard specifications.
 */

export interface FhirMeta {
  versionId?: string;
  lastUpdated?: string;
  profile?: string[];
  source?: string;
}

export interface FhirCoding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirIdentifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: FhirCodeableConcept;
  system?: string;
  value?: string;
  period?: FhirPeriod;
  assigner?: FhirReference;
}

export interface FhirReference {
  reference?: string;
  type?: string;
  identifier?: FhirIdentifier;
  display?: string;
}

export interface FhirPeriod {
  start?: string;
  end?: string;
}

export interface FhirHumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
}

export interface FhirContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
}

export interface FhirAddress {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface FhirAttachment {
  contentType?: string;
  language?: string;
  data?: string;
  url?: string;
  size?: number;
  hash?: string;
  title?: string;
  creation?: string;
}

export interface FhirAnnotation {
  authorReference?: FhirReference;
  authorString?: string;
  time?: string;
  text: string;
}

/**
 * Base FHIR R4 Resource interface
 */
export interface FhirResource {
  resourceType: string;
  id: string;
  meta?: FhirMeta;
  implicitRules?: string;
  language?: string;
  identifier?: FhirIdentifier[];
  [key: string]: unknown;
}

/**
 * FHIR R4 Patient Resource
 */
export interface FhirPatient extends FhirResource {
  resourceType: 'Patient';
  active?: boolean;
  name?: FhirHumanName[];
  telecom?: FhirContactPoint[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  address?: FhirAddress[];
  managingOrganization?: FhirReference;
}

/**
 * FHIR R4 Practitioner Resource
 */
export interface FhirPractitioner extends FhirResource {
  resourceType: 'Practitioner';
  active?: boolean;
  name?: FhirHumanName[];
  telecom?: FhirContactPoint[];
  qualification?: Array<{
    identifier?: FhirIdentifier[];
    code: FhirCodeableConcept;
    period?: FhirPeriod;
    issuer?: FhirReference;
  }>;
}

/**
 * FHIR R4 Organization Resource
 */
export interface FhirOrganization extends FhirResource {
  resourceType: 'Organization';
  active?: boolean;
  type?: FhirCodeableConcept[];
  name?: string;
  alias?: string[];
  telecom?: FhirContactPoint[];
  address?: FhirAddress[];
}

/**
 * FHIR R4 Encounter Resource
 */
export interface FhirEncounter extends FhirResource {
  resourceType: 'Encounter';
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  class: FhirCoding;
  type?: FhirCodeableConcept[];
  serviceType?: FhirCodeableConcept;
  subject?: FhirReference;
  participant?: Array<{
    type?: FhirCodeableConcept[];
    individual?: FhirReference;
    period?: FhirPeriod;
  }>;
  period?: FhirPeriod;
  reasonCode?: FhirCodeableConcept[];
  serviceProvider?: FhirReference;
}

/**
 * FHIR R4 Condition Resource
 */
export interface FhirCondition extends FhirResource {
  resourceType: 'Condition';
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  category?: FhirCodeableConcept[];
  severity?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
  subject: FhirReference;
  encounter?: FhirReference;
  onsetDateTime?: string;
  recordedDate?: string;
  recorder?: FhirReference;
  asserter?: FhirReference | { display: string };
  note?: FhirAnnotation[];
}

/**
 * FHIR R4 Observation Resource
 */
export interface FhirObservation extends FhirResource {
  resourceType: 'Observation';
  status: 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  effectivePeriod?: FhirPeriod;
  issued?: string;
  performer?: Array<FhirReference | { display: string }>;
  valueString?: string;
  note?: FhirAnnotation[];
}

/**
 * FHIR R4 DiagnosticReport Resource
 */
export interface FhirDiagnosticReport extends FhirResource {
  resourceType: 'DiagnosticReport';
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: FhirCodeableConcept[];
  code: FhirCodeableConcept;
  subject?: FhirReference;
  encounter?: FhirReference;
  effectiveDateTime?: string;
  issued?: string;
  performer?: Array<FhirReference | { display: string }>;
  result?: FhirReference[];
  presentedForm?: FhirAttachment[];
}

/**
 * FHIR R4 MedicationRequest Resource
 */
export interface FhirMedicationRequest extends FhirResource {
  resourceType: 'MedicationRequest';
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
  intent: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order' | 'instance-order' | 'option';
  category?: FhirCodeableConcept[];
  medicationCodeableConcept?: FhirCodeableConcept;
  medicationReference?: FhirReference;
  subject: FhirReference;
  encounter?: FhirReference;
  authoredOn?: string;
  requester?: FhirReference | { reference?: string; display?: string };
  note?: FhirAnnotation[];
}

/**
 * FHIR R4 DocumentReference Resource
 */
export interface FhirDocumentReference extends FhirResource {
  resourceType: 'DocumentReference';
  status: 'current' | 'superseded' | 'entered-in-error';
  docStatus?: 'preliminary' | 'final' | 'amended' | 'entered-in-error';
  type?: FhirCodeableConcept;
  category?: FhirCodeableConcept[];
  subject?: FhirReference;
  date?: string;
  author?: Array<FhirReference | { display: string }>;
  custodian?: FhirReference | { display: string };
  description?: string;
  securityLabel?: FhirCodeableConcept[];
  content: Array<{
    attachment: FhirAttachment;
  }>;
}

/**
 * FHIR R4 Consent Resource
 */
export interface FhirConsent extends FhirResource {
  resourceType: 'Consent';
  status: 'draft' | 'proposed' | 'active' | 'rejected' | 'inactive' | 'entered-in-error';
  scope: FhirCodeableConcept;
  category: FhirCodeableConcept[];
  patient?: FhirReference;
  dateTime?: string;
  performer?: FhirReference[];
  provision?: {
    type?: 'deny' | 'permit';
    period?: FhirPeriod;
    class?: FhirCoding[];
  };
}

/**
 * FHIR R4 AuditEvent Resource
 */
export interface FhirAuditEvent extends FhirResource {
  resourceType: 'AuditEvent';
  type: FhirCoding;
  subtype?: FhirCoding[];
  action?: 'C' | 'R' | 'U' | 'D' | 'E';
  recorded: string;
  outcome?: '0' | '4' | '8' | '12';
  outcomeDesc?: string;
  agent: Array<{
    type?: FhirCodeableConcept;
    who?: FhirReference;
    requestor: boolean;
  }>;
  source: {
    observer: FhirReference | { display: string };
  };
  entity?: Array<{
    what?: FhirReference;
    type?: FhirCoding;
    role?: FhirCoding;
  }>;
}

/**
 * FHIR R4 Bundle Resource
 */
export interface FhirBundleEntry<T = FhirResource> {
  fullUrl?: string;
  resource: T;
  search?: {
    mode?: 'match' | 'include' | 'outcome';
    score?: number;
  };
}

export interface FhirBundle extends FhirResource {
  resourceType: 'Bundle';
  type: 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';
  timestamp?: string;
  total?: number;
  link?: Array<{
    relation: string;
    url: string;
  }>;
  entry?: FhirBundleEntry[];
}

/**
 * FHIR R4 CapabilityStatement Resource
 */
export interface FhirCapabilityStatement {
  resourceType: 'CapabilityStatement';
  id: string;
  status: 'active';
  date: string;
  publisher: string;
  kind: 'instance';
  software: {
    name: string;
    version: string;
  };
  implementation: {
    description: string;
    url: string;
  };
  fhirVersion: '4.0.1';
  format: string[];
  rest: Array<{
    mode: 'server';
    resource: Array<{
      type: string;
      interaction: Array<{ code: string }>;
      searchParam?: Array<{ name: string; type: string; documentation: string }>;
    }>;
  }>;
}
