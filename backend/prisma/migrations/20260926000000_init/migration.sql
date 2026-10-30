-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PATIENT', 'DOCTOR', 'NURSE', 'ORGANIZATION_ADMIN', 'AUDITOR', 'PLATFORM_ADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('HOSPITAL', 'CLINIC', 'DIAGNOSTIC_LAB', 'REGULATORY');

-- CreateEnum
CREATE TYPE "DoctorVerificationStatus" AS ENUM ('VERIFIED', 'PENDING', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RecordCategory" AS ENUM ('Laboratory', 'Medication', 'Imaging', 'Clinical', 'Vaccination', 'Genomic', 'Cardiology');

-- CreateEnum
CREATE TYPE "RecordFileType" AS ENUM ('PDF', 'JPG', 'PNG', 'DICOM', 'JSON');

-- CreateEnum
CREATE TYPE "StorageStatus" AS ENUM ('ENCRYPTED_AND_ANCHORED', 'PENDING', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'TOMBSTONED');

-- CreateEnum
CREATE TYPE "RequestPurpose" AS ENUM ('Diagnosis', 'Routine_Follow_up', 'Second_Opinion', 'Surgical_Prep', 'Emergency_Treatment', 'Prescription_Renewal');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EmergencyAccessLevel" AS ENUM ('PARTIAL', 'FULL');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "DisputeReason" AS ENUM ('Unauthorized_access', 'Incorrect_emergency_claim', 'Incorrect_record_accessed', 'Unexpected_access_duration', 'Other');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_INVESTIGATION', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditAccessType" AS ENUM ('NORMAL', 'EMERGENCY', 'SYSTEM', 'REVOCATION', 'DISPUTE');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('COMPLETED', 'REVIEW_REQUIRED', 'REVOKED', 'DISPUTED', 'LOGGED');

-- CreateEnum
CREATE TYPE "ActorRole" AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('PATIENT_PROVIDER', 'PATIENT_CARE_TEAM', 'PATIENT_ORGANIZATION', 'PROVIDER_ORGANIZATION');

-- CreateEnum
CREATE TYPE "RelationshipStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'HOSPITAL',
    "address" TEXT,
    "contactEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PATIENT',
    "phone" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLogin" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT,
    "patientId" TEXT,
    "dob" TEXT,
    "gender" TEXT,
    "bloodGroup" TEXT,
    "doctorId" TEXT,
    "licenseId" TEXT,
    "specialization" TEXT,
    "hospital" TEXT,
    "verificationStatus" "DoctorVerificationStatus" DEFAULT 'PENDING',
    "adminId" TEXT,
    "department" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "records_metadata" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "category" "RecordCategory" NOT NULL,
    "description" TEXT,
    "fileType" "RecordFileType" NOT NULL DEFAULT 'PDF',
    "fileSize" TEXT NOT NULL DEFAULT '1.0 MB',
    "encryptedIpfsHash" TEXT NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT true,
    "storageStatus" "StorageStatus" NOT NULL DEFAULT 'ENCRYPTED_AND_ANCHORED',
    "issuingClinician" TEXT,
    "issuingHospital" TEXT,
    "recordDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wrappedDek" TEXT,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "encryptionAlgorithm" TEXT NOT NULL DEFAULT 'AES-256-GCM',
    "iv" TEXT,
    "authTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creatorId" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "onChainRecordId" TEXT,
    "onChainTxHash" TEXT,
    "recordStatus" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "records_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "record_versions" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT,
    "fileType" "RecordFileType" NOT NULL DEFAULT 'PDF',
    "fileSize" TEXT NOT NULL DEFAULT '1.0 MB',
    "encryptedIpfsHash" TEXT NOT NULL,
    "sha256Hash" TEXT NOT NULL,
    "wrappedDek" TEXT,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "encryptionAlgorithm" TEXT NOT NULL DEFAULT 'AES-256-GCM+ENVELOPE',
    "iv" TEXT,
    "authTag" TEXT,
    "creatorId" TEXT NOT NULL,
    "organizationId" TEXT,
    "changeSummary" TEXT,
    "onChainTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "record_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceName" TEXT,
    "lastIp" TEXT,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "purpose" "RequestPurpose" NOT NULL DEFAULT 'Diagnosis',
    "durationDays" INTEGER NOT NULL DEFAULT 7,
    "anomalyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "riskAssessment" JSONB,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "isBatched" BOOLEAN NOT NULL DEFAULT false,
    "batchGroupId" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_grants" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "accessStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accessExpiry" TIMESTAMP(3) NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'ACTIVE',
    "scopeNote" TEXT,
    "onChainTxHash" TEXT,
    "onChainGrantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_batches" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "recordType" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 14,
    "riskLevel" TEXT NOT NULL DEFAULT 'Low',
    "status" "BatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_events" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "hospital" TEXT NOT NULL,
    "verificationTier" "EmergencyAccessLevel" NOT NULL DEFAULT 'PARTIAL',
    "recordsAccessed" JSONB NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 15,
    "reason" TEXT NOT NULL,
    "emergencyCode" TEXT,
    "hospitalVerified" BOOLEAN NOT NULL DEFAULT true,
    "verificationData" JSONB,
    "accessWindowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoRevokeTimestamp" TIMESTAMP(3) NOT NULL,
    "reconciliationStatus" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "onChainTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "emergencyEventId" TEXT NOT NULL,
    "reason" "DisputeReason" NOT NULL DEFAULT 'Other',
    "details" TEXT NOT NULL,
    "attachedDocName" TEXT,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "onChainTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" "ActorRole" NOT NULL DEFAULT 'DOCTOR',
    "hospital" TEXT,
    "recordType" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "accessType" "AuditAccessType" NOT NULL DEFAULT 'NORMAL',
    "status" "AuditStatus" NOT NULL DEFAULT 'COMPLETED',
    "ipAddress" TEXT,
    "txHash" TEXT,
    "onChainEventName" TEXT,
    "onChainBlockNumber" BIGINT,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trust_relationships" (
    "id" TEXT NOT NULL,
    "relationshipType" "RelationshipType" NOT NULL,
    "status" "RelationshipStatus" NOT NULL DEFAULT 'PENDING',
    "subjectId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "organizationId" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "onChainTxHash" TEXT,
    "onChainId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trust_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_patientId_key" ON "users"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "users_doctorId_key" ON "users"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "users_adminId_key" ON "users"("adminId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_patientId_idx" ON "users"("patientId");

-- CreateIndex
CREATE INDEX "users_doctorId_idx" ON "users"("doctorId");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "records_metadata_patientId_idx" ON "records_metadata"("patientId");

-- CreateIndex
CREATE INDEX "records_metadata_organizationId_idx" ON "records_metadata"("organizationId");

-- CreateIndex
CREATE INDEX "records_metadata_category_idx" ON "records_metadata"("category");

-- CreateIndex
CREATE INDEX "records_metadata_sha256Hash_idx" ON "records_metadata"("sha256Hash");

-- CreateIndex
CREATE INDEX "records_metadata_creatorId_idx" ON "records_metadata"("creatorId");

-- CreateIndex
CREATE INDEX "records_metadata_recordStatus_idx" ON "records_metadata"("recordStatus");

-- CreateIndex
CREATE INDEX "record_versions_recordId_idx" ON "record_versions"("recordId");

-- CreateIndex
CREATE INDEX "record_versions_creatorId_idx" ON "record_versions"("creatorId");

-- CreateIndex
CREATE INDEX "record_versions_organizationId_idx" ON "record_versions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "record_versions_recordId_versionNumber_key" ON "record_versions"("recordId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_tokenHash_idx" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "device_sessions_userId_idx" ON "device_sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "device_sessions_userId_deviceId_key" ON "device_sessions"("userId", "deviceId");

-- CreateIndex
CREATE INDEX "access_requests_patientId_idx" ON "access_requests"("patientId");

-- CreateIndex
CREATE INDEX "access_requests_doctorId_idx" ON "access_requests"("doctorId");

-- CreateIndex
CREATE INDEX "access_requests_status_idx" ON "access_requests"("status");

-- CreateIndex
CREATE INDEX "access_requests_isFlagged_idx" ON "access_requests"("isFlagged");

-- CreateIndex
CREATE INDEX "access_requests_batchGroupId_idx" ON "access_requests"("batchGroupId");

-- CreateIndex
CREATE INDEX "access_grants_patientId_idx" ON "access_grants"("patientId");

-- CreateIndex
CREATE INDEX "access_grants_doctorId_idx" ON "access_grants"("doctorId");

-- CreateIndex
CREATE INDEX "access_grants_status_idx" ON "access_grants"("status");

-- CreateIndex
CREATE INDEX "access_grants_accessExpiry_idx" ON "access_grants"("accessExpiry");

-- CreateIndex
CREATE INDEX "consent_batches_patientId_idx" ON "consent_batches"("patientId");

-- CreateIndex
CREATE INDEX "consent_batches_status_idx" ON "consent_batches"("status");

-- CreateIndex
CREATE INDEX "emergency_events_patientId_idx" ON "emergency_events"("patientId");

-- CreateIndex
CREATE INDEX "emergency_events_doctorId_idx" ON "emergency_events"("doctorId");

-- CreateIndex
CREATE INDEX "emergency_events_reconciliationStatus_idx" ON "emergency_events"("reconciliationStatus");

-- CreateIndex
CREATE INDEX "emergency_events_autoRevokeTimestamp_idx" ON "emergency_events"("autoRevokeTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_emergencyEventId_key" ON "disputes"("emergencyEventId");

-- CreateIndex
CREATE INDEX "disputes_patientId_idx" ON "disputes"("patientId");

-- CreateIndex
CREATE INDEX "disputes_emergencyEventId_idx" ON "disputes"("emergencyEventId");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "audit_log_patientId_idx" ON "audit_log"("patientId");

-- CreateIndex
CREATE INDEX "audit_log_actorId_idx" ON "audit_log"("actorId");

-- CreateIndex
CREATE INDEX "audit_log_accessType_idx" ON "audit_log"("accessType");

-- CreateIndex
CREATE INDEX "audit_log_status_idx" ON "audit_log"("status");

-- CreateIndex
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log"("timestamp");

-- CreateIndex
CREATE INDEX "trust_relationships_subjectId_idx" ON "trust_relationships"("subjectId");

-- CreateIndex
CREATE INDEX "trust_relationships_targetUserId_idx" ON "trust_relationships"("targetUserId");

-- CreateIndex
CREATE INDEX "trust_relationships_organizationId_idx" ON "trust_relationships"("organizationId");

-- CreateIndex
CREATE INDEX "trust_relationships_relationshipType_idx" ON "trust_relationships"("relationshipType");

-- CreateIndex
CREATE INDEX "trust_relationships_status_idx" ON "trust_relationships"("status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records_metadata" ADD CONSTRAINT "records_metadata_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records_metadata" ADD CONSTRAINT "records_metadata_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records_metadata" ADD CONSTRAINT "records_metadata_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_versions" ADD CONSTRAINT "record_versions_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_versions" ADD CONSTRAINT "record_versions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_versions" ADD CONSTRAINT "record_versions_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "records_metadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sessions" ADD CONSTRAINT "device_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_batchGroupId_fkey" FOREIGN KEY ("batchGroupId") REFERENCES "consent_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_requests" ADD CONSTRAINT "access_requests_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "access_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_batches" ADD CONSTRAINT "consent_batches_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_events" ADD CONSTRAINT "emergency_events_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_events" ADD CONSTRAINT "emergency_events_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_emergencyEventId_fkey" FOREIGN KEY ("emergencyEventId") REFERENCES "emergency_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_relationships" ADD CONSTRAINT "trust_relationships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_relationships" ADD CONSTRAINT "trust_relationships_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trust_relationships" ADD CONSTRAINT "trust_relationships_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

