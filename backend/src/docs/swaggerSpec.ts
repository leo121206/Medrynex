export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Medrynx EHR Platform API',
    version: '2.0.0',
    description: `### Decentralized Healthcare Data Platform
Medrynx is an enterprise EHR platform integrating:
- **Envelope Encryption**: AES-256-GCM data encryption keys (DEK) wrapped under Key Encryption Keys (KEK) via KMS.
- **Decentralized Storage**: Content-addressed IPFS storage with SHA-256 integrity anchoring.
- **Attribute-Based Access Control (ABAC)**: Multi-tenant boundary checks and purpose-bound access.
- **Blockchain Smart Contracts**: Immutable scope-bound consent grants and tiered break-glass emergency auditing.
- **HL7 FHIR R4 Standard**: Full healthcare interoperability layer for Patient, Practitioner, Organization, DocumentReference, Consent, and AuditEvent resources.`,
    contact: {
      name: 'Medrynx Engineering Support',
      email: 'support@medrynx.org',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1 Base Endpoint',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide JWT access token in format: Bearer <token>',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation completed successfully' },
          data: { type: 'object' },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'UNAUTHORIZED' },
              message: { type: 'string', example: 'Authentication required' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      UserRegistration: {
        type: 'object',
        required: ['name', 'email', 'password', 'role'],
        properties: {
          name: { type: 'string', example: 'Dr. Jane Doe' },
          email: { type: 'string', format: 'email', example: 'jane.doe@hospital.org' },
          password: { type: 'string', minLength: 6, example: 'Password123!' },
          role: {
            type: 'string',
            enum: ['PATIENT', 'DOCTOR', 'NURSE', 'ADMIN', 'ORGANIZATION_ADMIN', 'AUDITOR'],
            example: 'DOCTOR',
          },
          organizationId: { type: 'string', example: 'org-hosp-001' },
          specialization: { type: 'string', example: 'Cardiology' },
          licenseId: { type: 'string', example: 'MCI-2023-88421' },
          hospital: { type: 'string', example: 'ABC Hospital' },
        },
      },
      UserLogin: {
        type: 'object',
        required: ['email', 'password', 'role'],
        properties: {
          email: { type: 'string', format: 'email', example: 'patient@medrynx.org' },
          password: { type: 'string', example: 'Password123!' },
          role: { type: 'string', enum: ['PATIENT', 'DOCTOR', 'ADMIN'], example: 'PATIENT' },
        },
      },
      MedicalRecord: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'rec-001' },
          patientId: { type: 'string', example: 'PT-98234' },
          patientName: { type: 'string', example: 'Karna Sharma' },
          title: { type: 'string', example: 'Complete Blood Count (CBC)' },
          category: {
            type: 'string',
            enum: ['GeneralHealth', 'Laboratory', 'Imaging', 'Prescription', 'Surgical', 'Immunization', 'Cardiology', 'Allergies', 'EmergencySummary'],
            example: 'Laboratory',
          },
          fileType: { type: 'string', enum: ['PDF', 'PNG', 'JPG', 'DICOM', 'JSON'], example: 'PDF' },
          fileSize: { type: 'string', example: '1.4 MB' },
          ipfsCid: { type: 'string', example: 'QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco' },
          sha256Hash: { type: 'string', example: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4' },
          isEncrypted: { type: 'boolean', example: true },
          storageStatus: { type: 'string', example: 'Encrypted & Anchored' },
          downloadUrl: { type: 'string', example: '/api/v1/records/rec-001/download' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Full system health overview',
        tags: ['Observability'],
        responses: {
          200: { description: 'System healthy', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } } },
        },
      },
    },
    '/health/liveness': {
      get: {
        summary: 'Liveness probe for orchestrators (Kubernetes / Docker)',
        tags: ['Observability'],
        responses: {
          200: { description: 'Container is live' },
        },
      },
    },
    '/health/readiness': {
      get: {
        summary: 'Readiness probe verifying DB, KMS, and storage dependencies',
        tags: ['Observability'],
        responses: {
          200: { description: 'Dependencies ready to accept traffic' },
          503: { description: 'Service degraded or initializing' },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Register new platform user',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserRegistration' } } },
        },
        responses: {
          201: { description: 'User created' },
          409: { description: 'Email conflict' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'User authentication with rate-limiting & brute-force lockout',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserLogin' } } },
        },
        responses: {
          200: { description: 'Authenticated successfully with JWT & refresh token' },
          401: { description: 'Invalid credentials or role mismatch' },
          403: { description: 'Account temporarily locked due to excessive failed attempts' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Rotate refresh token and obtain new JWT access token',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { refreshToken: { type: 'string' } } } } },
        },
        responses: {
          200: { description: 'New JWT access token issued' },
          401: { description: 'Invalid or revoked refresh token' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Revoke active refresh token session',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { refreshToken: { type: 'string' } } } } },
        },
        responses: {
          200: { description: 'Session successfully revoked' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get profile of currently authenticated user',
        tags: ['Authentication'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'User profile retrieved' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/records': {
      get: {
        summary: 'List accessible health records (filtered by ABAC policy)',
        tags: ['Records'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'patientId', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'List of records' },
        },
      },
      post: {
        summary: 'Upload, envelope-encrypt, and anchor medical record to IPFS',
        tags: ['Records'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                  title: { type: 'string', example: 'Diagnostic Blood Chemistry' },
                  category: { type: 'string', example: 'Laboratory' },
                  description: { type: 'string', example: 'Annual comprehensive metabolic panel' },
                  patientId: { type: 'string', example: 'PT-98234' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Record encrypted and anchored' },
        },
      },
    },
    '/records/{id}/download': {
      get: {
        summary: 'Download and decrypt medical record (verified with ABAC & DEK unwrapping)',
        tags: ['Records'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Decrypted binary payload' },
          403: { description: 'ABAC policy rejection (no active consent or emergency)' },
          404: { description: 'Record not found' },
        },
      },
    },
    '/consent': {
      get: {
        summary: 'List consent grants',
        tags: ['Consent'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'List of grants' } },
      },
      post: {
        summary: 'Grant scope-bound dynamic consent on-chain',
        tags: ['Consent'],
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Consent grant confirmed on blockchain' } },
      },
    },
    '/consent/batch': {
      post: {
        summary: 'Batch grant consents for multidisciplinary care teams',
        tags: ['Consent'],
        security: [{ BearerAuth: [] }],
        responses: { 201: { description: 'Batch consent executed in single atomic transaction' } },
      },
    },
    '/emergency': {
      post: {
        summary: 'Trigger tiered break-glass emergency access override',
        tags: ['Emergency'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'Emergency access granted with immutable audit lock' } },
      },
    },
    '/fhir/metadata': {
      get: {
        summary: 'HL7 FHIR R4 CapabilityStatement (Conformance)',
        tags: ['HL7 FHIR Interoperability'],
        responses: {
          200: { description: 'FHIR CapabilityStatement conforming to R4 specification' },
        },
      },
    },
    '/fhir/Patient/{id}': {
      get: {
        summary: 'Get FHIR R4 Patient resource',
        tags: ['HL7 FHIR Interoperability'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'FHIR Patient JSON' } },
      },
    },
    '/fhir/DocumentReference': {
      get: {
        summary: 'Search FHIR R4 DocumentReference bundle',
        tags: ['HL7 FHIR Interoperability'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'FHIR DocumentReference Bundle' } },
      },
    },
    '/fhir/Consent': {
      get: {
        summary: 'Search FHIR R4 Consent bundle',
        tags: ['HL7 FHIR Interoperability'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'FHIR Consent Bundle' } },
      },
    },
    '/fhir/AuditEvent': {
      get: {
        summary: 'Search FHIR R4 AuditEvent bundle',
        tags: ['HL7 FHIR Interoperability'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'FHIR AuditEvent Bundle' } },
      },
    },
  },
};
