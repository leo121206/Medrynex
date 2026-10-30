import { FhirResource, FhirBundle } from './fhir.types';
import { ApiError } from '../utils/apiError';

export const SUPPORTED_RESOURCE_TYPES = [
  'Patient',
  'Practitioner',
  'Organization',
  'Encounter',
  'Condition',
  'Observation',
  'DiagnosticReport',
  'MedicationRequest',
  'DocumentReference',
  'Consent',
  'AuditEvent',
  'Bundle',
  'CapabilityStatement',
] as const;

export type SupportedResourceType = typeof SUPPORTED_RESOURCE_TYPES[number];

const ID_REGEX = /^[A-Za-z0-9\-_.]{1,64}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?)?$/;
const REFERENCE_REGEX = /^[A-Z][A-Za-z]+\/[A-Za-z0-9\-_.]{1,64}$/;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a single FHIR R4 resource against required standard constraints.
 */
export function validateFhirResource(resource: any): ValidationResult {
  const errors: string[] = [];

  if (!resource || typeof resource !== 'object') {
    return { valid: false, errors: ['Resource must be a non-null JSON object'] };
  }

  // 1. Validate resourceType
  if (!resource.resourceType || typeof resource.resourceType !== 'string') {
    errors.push('Missing or invalid resourceType');
  } else if (!SUPPORTED_RESOURCE_TYPES.includes(resource.resourceType as any)) {
    errors.push(`Unsupported resourceType: ${resource.resourceType}`);
  }

  // 2. Validate id
  if (resource.resourceType !== 'CapabilityStatement') {
    if (!resource.id || typeof resource.id !== 'string') {
      errors.push('Missing or invalid resource id');
    } else if (!ID_REGEX.test(resource.id) || resource.id.includes('..') || resource.id.includes('/') || resource.id.includes('\\')) {
      errors.push(`Invalid id format or forbidden path characters in id: ${resource.id}`);
    }
  }

  // 3. Resource-specific required fields & constraints
  switch (resource.resourceType) {
    case 'Patient':
      if (resource.name && !Array.isArray(resource.name)) {
        errors.push('Patient.name must be an array');
      }
      if (resource.gender && !['male', 'female', 'other', 'unknown'].includes(resource.gender)) {
        errors.push(`Invalid Patient.gender: ${resource.gender}`);
      }
      break;

    case 'Practitioner':
      if (resource.name && !Array.isArray(resource.name)) {
        errors.push('Practitioner.name must be an array');
      }
      break;

    case 'Organization':
      if (resource.name && typeof resource.name !== 'string') {
        errors.push('Organization.name must be a string');
      }
      break;

    case 'Encounter':
      if (!resource.status || typeof resource.status !== 'string') {
        errors.push('Encounter.status is required');
      }
      if (!resource.class || typeof resource.class !== 'object' || !resource.class.code) {
        errors.push('Encounter.class Coding with code is required');
      }
      if (resource.subject?.reference && !REFERENCE_REGEX.test(resource.subject.reference)) {
        errors.push(`Invalid Encounter.subject reference format: ${resource.subject.reference}`);
      }
      break;

    case 'Condition':
      if (!resource.subject || typeof resource.subject !== 'object' || !resource.subject.reference) {
        errors.push('Condition.subject reference is required');
      }
      if (!resource.code || typeof resource.code !== 'object') {
        errors.push('Condition.code is required');
      }
      break;

    case 'Observation':
      if (!resource.status || typeof resource.status !== 'string') {
        errors.push('Observation.status is required');
      }
      if (!resource.code || typeof resource.code !== 'object') {
        errors.push('Observation.code is required');
      }
      if (resource.subject?.reference && !REFERENCE_REGEX.test(resource.subject.reference)) {
        errors.push(`Invalid Observation.subject reference format: ${resource.subject.reference}`);
      }
      break;

    case 'DiagnosticReport':
      if (!resource.status || typeof resource.status !== 'string') {
        errors.push('DiagnosticReport.status is required');
      }
      if (!resource.code || typeof resource.code !== 'object') {
        errors.push('DiagnosticReport.code is required');
      }
      if (resource.subject?.reference && !REFERENCE_REGEX.test(resource.subject.reference)) {
        errors.push(`Invalid DiagnosticReport.subject reference format: ${resource.subject.reference}`);
      }
      break;

    case 'MedicationRequest':
      if (!resource.status || typeof resource.status !== 'string') {
        errors.push('MedicationRequest.status is required');
      }
      if (!resource.intent || typeof resource.intent !== 'string') {
        errors.push('MedicationRequest.intent is required');
      }
      if (!resource.subject || typeof resource.subject !== 'object' || !resource.subject.reference) {
        errors.push('MedicationRequest.subject reference is required');
      }
      break;

    case 'DocumentReference':
      if (!resource.status || typeof resource.status !== 'string') {
        errors.push('DocumentReference.status is required');
      }
      if (!resource.content || !Array.isArray(resource.content) || resource.content.length === 0) {
        errors.push('DocumentReference.content array with at least one attachment is required');
      }
      break;

    case 'Consent':
      if (!resource.status || typeof resource.status !== 'string') {
        errors.push('Consent.status is required');
      }
      if (!resource.scope || typeof resource.scope !== 'object') {
        errors.push('Consent.scope is required');
      }
      if (!resource.category || !Array.isArray(resource.category)) {
        errors.push('Consent.category array is required');
      }
      break;

    case 'AuditEvent':
      if (!resource.type || typeof resource.type !== 'object') {
        errors.push('AuditEvent.type is required');
      }
      if (!resource.recorded || typeof resource.recorded !== 'string' || !ISO_DATE_REGEX.test(resource.recorded)) {
        errors.push('AuditEvent.recorded valid ISO date is required');
      }
      if (!resource.agent || !Array.isArray(resource.agent) || resource.agent.length === 0) {
        errors.push('AuditEvent.agent array is required');
      }
      break;

    case 'Bundle':
      if (!resource.type || typeof resource.type !== 'string') {
        errors.push('Bundle.type is required');
      } else if (!['searchset', 'collection', 'document', 'batch', 'history', 'transaction'].includes(resource.type)) {
        errors.push(`Invalid Bundle.type: ${resource.type}`);
      }
      if (resource.entry && !Array.isArray(resource.entry)) {
        errors.push('Bundle.entry must be an array');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates a resource or throws ApiError.badRequest if validation fails.
 */
export function assertValidFhirResource<T = FhirResource>(resource: T): T {
  const result = validateFhirResource(resource);
  if (!result.valid) {
    throw ApiError.badRequest(`FHIR R4 Validation Error: ${result.errors.join('; ')}`);
  }
  return resource;
}

/**
 * Validates a complete FHIR Bundle and all nested entries.
 */
export function assertValidFhirBundle(bundle: FhirBundle): FhirBundle {
  assertValidFhirResource(bundle);
  if (bundle.entry && Array.isArray(bundle.entry)) {
    for (let i = 0; i < bundle.entry.length; i++) {
      const entry = bundle.entry[i];
      if (!entry || !entry.resource) {
        throw ApiError.badRequest(`FHIR Bundle entry at index ${i} is missing resource`);
      }
      const itemResult = validateFhirResource(entry.resource);
      if (!itemResult.valid) {
        throw ApiError.badRequest(`FHIR Bundle entry at index ${i} invalid: ${itemResult.errors.join('; ')}`);
      }
    }
  }
  return bundle;
}
