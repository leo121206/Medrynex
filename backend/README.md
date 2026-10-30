# Medrynx Backend Service

Enterprise backend service for **Medrynx** (formerly MediVault AI), a blockchain-anchored Electronic Health Record (EHR) system featuring **scope-bound dynamic consent** and **tiered emergency ("break-glass") access control**.

---

## 🛠️ Tech Stack

- **Runtime & Framework**: Node.js v22+, Express 4, TypeScript 5
- **Database & ORM**: PostgreSQL with Prisma ORM
- **Security & Auth**: JWT (Bearer tokens), bcryptjs, Helmet, CORS
- **Validation & Errors**: Zod schema validation, centralized RFC-compliant API error handling
- **Testing**: Vitest, Supertest
- **Decentralized Storage**: IPFS (AES-256 encrypted payload before upload)
- **Blockchain**: Solidity smart contracts, Hardhat, ethers.js, local Ganache network

---

## 📁 Directory Architecture

```
backend/
├── .env.example              # Template for environment variables
├── .env                      # Local environment configuration
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript compiler settings
├── vitest.config.ts          # Vitest testing suite configuration
├── prisma/
│   ├── schema.prisma         # Complete PostgreSQL domain models
│   └── seed.ts               # Database seeder with realistic fixtures
└── src/
    ├── app.ts                # Express application factory & middleware pipeline
    ├── server.ts             # HTTP server entrypoint & graceful shutdown
    ├── config/
    │   ├── env.ts            # Zod-validated environment config
    │   └── logger.ts         # Structured console logger
    ├── controllers/
    │   └── health.controller.ts # Health check handlers
    ├── middleware/
    │   ├── errorHandler.ts   # Centralized error handler
    │   ├── requestLogger.ts  # Request response-time logger
    │   └── validate.ts       # Zod request validation middleware
    ├── models/
    │   └── db.ts             # Singleton PrismaClient instance
    ├── routes/
    │   ├── index.ts          # Root API router (/api/v1)
    │   └── health.routes.ts  # Health check routes
    ├── services/
    │   └── health.service.ts # System & DB diagnostic services
    ├── tests/
    │   ├── error.test.ts     # Error handler and validation tests
    │   └── health.test.ts    # Health check & 404 tests
    ├── types/
    │   └── common.types.ts   # Common interfaces & Express user augmentation
    └── utils/
        ├── apiError.ts       # Standardized ApiError class
        └── apiResponse.ts    # Standardized ApiResponse envelope
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Key environment parameters:
| Parameter | Default | Description |
|-----------|---------|-------------|
| `PORT` | `5000` | HTTP service port |
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string |
| `JWT_SECRET` | - | Secret key for JWT signing |
| `GANACHE_RPC_URL` | `http://127.0.0.1:7545` | Local Ethereum Ganache RPC |
| `IPFS_GATEWAY_URL` | `https://ipfs.io/ipfs/` | IPFS gateway for retrieval |
| `ANOMALY_THRESHOLD` | `65` | ML risk score cutoff (0-100) |

### 3. Generate Prisma Client & Database
```bash
npm run prisma:generate
npm run prisma:push    # Or npm run prisma:migrate
npm run prisma:seed    # Seeds default test patients, doctors, records & logs
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Run Test Suite
```bash
npm test
```

---

## 🩺 Endpoints (Module 1)

### 1. Health Check
- **Endpoint**: `GET /api/v1/health`
- **Access**: Public
- **Description**: Returns server status, uptime, node version, and connectivity to auxiliary services (DB, Ganache, IPFS).

#### Example Response (`200 OK`):
```json
{
  "success": true,
  "message": "System is healthy and operational",
  "data": {
    "status": "healthy",
    "uptimeSeconds": 42,
    "timestamp": "2026-09-17T17:45:10.123Z",
    "environment": "development",
    "nodeVersion": "v22.16.0",
    "services": {
      "database": "connected",
      "ganacheRpc": "configured",
      "ipfsGateway": "configured"
    }
  }
}
```

### 2. Centralized Error Envelope
All error responses adhere to a consistent structure:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request payload failed schema validation",
    "details": [
      {
        "field": "body.email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

---

## 🗄️ Database Schema Overview (Module 2)

The schema in `prisma/schema.prisma` models all core entities required across the 10 project modules:

| Table | Model Name | Description |
|-------|------------|-------------|
| `users` | `User` | Patients, Doctors, and Admins with role-specific columns (`specialization`, `licenseId`, `patientId`, `bloodGroup`, `permissions`). |
| `records_metadata` | `RecordMetadata` | Patient medical records with category, `encryptedIpfsHash` (IPFS CID), and `sha256Hash` (anchored on-chain). |
| `access_requests` | `AccessRequest` | Clinician access requests with ML anomaly score (`0-100`), `isFlagged` threshold flag, and batch group link. |
| `access_grants` | `AccessGrant` | Scope-bound consents enforced by record category, time window (`accessStart` to `accessExpiry`), and linked `onChainTxHash`. |
| `consent_batches` | `ConsentBatch` | Aggregates homogeneous low-risk requests from a declared care team for single-click patient approval. |
| `emergency_events` | `EmergencyEvent` | Tiered break-glass access (`PARTIAL` vs `FULL`), emergency reason/code, duration limit, and auto-revoke deadline. |
| `disputes` | `Dispute` | Immutable append-only audit trail for post-emergency patient contestation. |
| `audit_log` | `AuditLog` | Denormalized mirror of routine & emergency on-chain events for sub-millisecond query performance on frontend Recharts dashboards. |

---

## 🔐 Auth Module Endpoints (Module 3)

### 1. User Registration
- **Endpoint**: `POST /api/v1/auth/register`
- **Access**: Public
- **Description**: Registers a new patient, doctor, or hospital admin with role-specific attributes. Passwords are salted and hashed with bcrypt (10 rounds). Automatically generates unique patient/doctor IDs if not supplied, and returns a signed JWT token along with the sanitized profile.

#### Example Patient Registration:
```json
POST /api/v1/auth/register
{
  "name": "Karna Sharma",
  "email": "karna@medrynx.org",
  "password": "Password123!",
  "role": "PATIENT",
  "phone": "+91 98765 43210",
  "dob": "1988-03-14",
  "gender": "Male",
  "bloodGroup": "O+"
}
```

#### Example Doctor Registration:
```json
POST /api/v1/auth/register
{
  "name": "Dr. Ananya Sharma",
  "email": "ananya@medrynx.org",
  "password": "Password123!",
  "role": "DOCTOR",
  "phone": "+91 98111 22233",
  "specialization": "Cardiology",
  "hospital": "ABC Hospital",
  "licenseId": "MCI-2019-94821"
}
```

#### Example Response (`201 Created`):
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "c7a8b9e1-2345-6789-abcd-ef0123456789",
      "email": "ananya@medrynx.org",
      "name": "Dr. Ananya Sharma",
      "role": "DOCTOR",
      "phone": "+91 98111 22233",
      "doctorId": "d-201",
      "licenseId": "MCI-2019-94821",
      "specialization": "Cardiology",
      "hospital": "ABC Hospital",
      "verificationStatus": "PENDING",
      "createdAt": "2026-09-18T05:15:00.000Z",
      "updatedAt": "2026-09-18T05:15:00.000Z",
      "lastLogin": "2026-09-18T05:15:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 2. User Login
- **Endpoint**: `POST /api/v1/auth/login`
- **Access**: Public
- **Description**: Authenticates existing credentials via bcrypt, validates optional role constraints, updates `lastLogin`, and returns a signed JWT session token.

#### Example Request:
```json
POST /api/v1/auth/login
{
  "email": "doctor@medrynx.org",
  "password": "Password123!"
}
```

#### Example Response (`200 OK`):
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "b3e214a1-0987-4321-fedc-ba9876543210",
      "email": "doctor@medrynx.org",
      "name": "Dr. Ananya Sharma",
      "role": "DOCTOR",
      "doctorId": "d-201",
      "hospital": "ABC Hospital",
      "verificationStatus": "VERIFIED"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 3. Current User Profile
- **Endpoint**: `GET /api/v1/auth/me`
- **Access**: Protected (`Bearer <JWT>`)
- **Header**: `Authorization: Bearer <token>`
- **Description**: Decodes JWT session, verifies authenticity, and fetches latest sanitized user profile.

---

### 4. Role Guards Middleware
Endpoints can be restricted to specific roles using `requireRole('ROLE')`:
```typescript
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';

// Only patients can grant/revoke consents or dispute emergencies
router.post('/consent/grant', authenticate, requireRole('PATIENT'), grantConsent);

// Only verified doctors can request access to records
router.post('/requests/create', authenticate, requireRole('DOCTOR'), createAccessRequest);

// Only hospital admins can override anomalies or view platform statistics
router.get('/admin/stats', authenticate, requireRole('ADMIN'), getPlatformStats);
```

---

## 📁 Medical Records & Encrypted Storage Module (Module 5 & Record Upload)

Files uploaded to Medrynx undergo client-side/server-side AES-256-GCM authenticated encryption. The plaintext is never stored unencrypted on disk. The encrypted blob is pushed to IPFS, and only its SHA-256 cryptographic integrity hash is anchored on the blockchain.

### 1. Upload & Encrypt Medical Record
- **Endpoint**: `POST /api/v1/records`
- **Access**: Protected (`PATIENT`, `DOCTOR`, `ADMIN`)
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `file`: The document to encrypt (PDF, JPG, PNG, DICOM, JSON up to 25MB)
  - `title`: String (e.g., "12-Lead Resting ECG Report")
  - `category`: Enum (`Laboratory`, `Medication`, `Imaging`, `Clinical`, `Vaccination`, `Genomic`, `Cardiology`)
  - `description`: String (optional)
  - `patientId`: String (required if clinician is uploading on behalf of a patient; optional for patient self-upload)
  - `issuingClinician`: String (optional)
  - `issuingHospital`: String (optional)
  - `recordDate`: ISO Date string (optional)

#### Example Response (`201 Created`):
```json
{
  "success": true,
  "message": "Medical record encrypted and stored successfully",
  "data": {
    "id": "e8a9bc14-8765-4321-bca9-09876543210f",
    "patientId": "PT-98234",
    "patientName": "Karna Sharma",
    "title": "Comprehensive Metabolic Panel (CMP)",
    "category": "Laboratory",
    "description": "Routine metabolic chemistry panel showing normal kidney and liver biomarkers.",
    "date": "18/09/2026",
    "uploadedAt": "2026-09-18T05:20:00.000Z",
    "isEncrypted": true,
    "fileType": "PDF",
    "fileSize": "1.4 MB",
    "sha256Hash": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    "storageStatus": "Encrypted & Anchored",
    "ipfsCid": "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
    "issuingClinician": "Dr. Priya Rao",
    "issuingHospital": "Care Hospital",
    "downloadUrl": "/api/v1/records/e8a9bc14-8765-4321-bca9-09876543210f/download"
  }
}
```

---

### 2. List Medical Records
- **Endpoint**: `GET /api/v1/records`
- **Access**: Protected
- **Query Parameters**:
  - `category`: Filter by record category (`Laboratory`, `Cardiology`, etc.)
  - `patientId`: Filter by patient identifier (for clinicians/admins)
- **Description**: Returns all records owned by the authenticated patient or permitted for the clinician.

---

### 3. Decrypt & Download Record
- **Endpoint**: `GET /api/v1/records/:id/download`
- **Access**: Protected (`PATIENT`, `DOCTOR`, `ADMIN`)
- **Security Check**:
  - If requested by a clinician, dynamically checks for an active, unexpired, in-scope `AccessGrant` matching the patient and record category, OR an active `EmergencyEvent` within its auto-revoke time window.
  - Verifies the SHA-256 hash of the encrypted IPFS blob before decryption.
  - Decrypts the binary payload with AES-256-GCM and streams the original file to the client with appropriate MIME headers.
  - Automatically records an audit trail entry in `audit_log`.


