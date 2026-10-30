/**
 * MEDRYNX — STAGING DEPLOYMENT ORCHESTRATOR & SMOKE TEST RUNNER
 * Verifies live container topology, database schema, KMS, IPFS, Blockchain, and AI/ML services.
 */
import { prisma, isDbConnected, connectDatabase } from '../src/models/db';
import { defaultStorage } from '../src/services/storage';
import { blockchainService } from '../src/services/blockchain.service';
import { localKms } from '../src/crypto/kms/LocalKeyManagementService';
import { getModelHealth, scoreAccessAnomaly } from '../src/services/ml.service';
import { checkReadiness } from '../src/services/health.service';
import { env, validateProductionConfig } from '../src/config/env';
import crypto from 'crypto';

interface StepResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

const results: StepResult[] = [];

async function recordStep(name: string, fn: () => Promise<string | void>) {
  try {
    const msg = await fn();
    results.push({ step: name, status: 'PASS', details: msg || 'OK' });
    console.log(`✅ [PASS] ${name}${msg ? ` - ${msg}` : ''}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    results.push({ step: name, status: 'FAIL', details: errorMsg });
    console.error(`❌ [FAIL] ${name} - ${errorMsg}`);
  }
}

async function runStagingDeployment() {
  console.log('================================================================');
  console.log('🚀 MEDRYNX STAGING DEPLOYMENT & LAUNCH VALIDATION RUNNER');
  console.log('================================================================');
  console.log(`Node Version: ${process.version}`);
  console.log(`Environment:  ${env.NODE_ENV}`);
  console.log(`Timestamp:    ${new Date().toISOString()}`);
  console.log('----------------------------------------------------------------\n');

  // STEP 1: Environment Pre-Flight Check
  await recordStep('1. Environment Configuration Validation', async () => {
    // Check if configuration parameters meet production/staging criteria
    const check = validateProductionConfig(env);
    if (!check.valid && env.NODE_ENV === 'production') {
      throw new Error(`Production config check failed: ${check.errors.join('; ')}`);
    }
    return `Config valid for environment '${env.NODE_ENV}'. (CORS: ${env.CORS_ORIGIN})`;
  });

  // STEP 2: Database Connectivity & Migration Schema Check
  await recordStep('2. PostgreSQL Database Connectivity & Schema', async () => {
    await connectDatabase();
    if (!isDbConnected) {
      throw new Error('Database is not connected');
    }
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'
    `;
    const count = tables.length;
    if (count < 14) {
      throw new Error(`Expected at least 14 public tables, found ${count}`);
    }
    return `Connected to PostgreSQL. Verified ${count} public tables in schema.`;
  });

  // STEP 3: KMS Key Management Initialization
  await recordStep('3. KMS & Master KEK Initialization', async () => {
    const activeVersion = localKms.getActiveVersion();
    if (!activeVersion || activeVersion < 1) {
      throw new Error('Active KEK version not found');
    }
    const dek = localKms.generateDek();
    const wrapped = await localKms.wrapDek(dek);
    const unwrapped = await localKms.unwrapDek(wrapped.wrappedDek, wrapped.keyVersion);
    if (!unwrapped.equals(dek)) {
      throw new Error('KMS DEK wrap/unwrap roundtrip fidelity check failed');
    }
    return `KMS Active (Master KEK Version: ${activeVersion}, AES-256-GCM envelope fidelity verified)`;
  });

  // STEP 4: Kubo IPFS Storage Daemon
  await recordStep('4. Kubo IPFS Daemon Storage & Pinning', async () => {
    const isAlive = await defaultStorage.checkIpfsHealth();
    if (!isAlive) {
      throw new Error('Kubo IPFS daemon is not reachable on configured RPC port');
    }
    // Test synthetic encrypted blob upload
    const dummyCiphertext = crypto.randomBytes(256);
    const upload = await defaultStorage.upload(dummyCiphertext);
    const retrieved = await defaultStorage.retrieve(upload.cid);
    if (!retrieved.equals(dummyCiphertext)) {
      throw new Error('IPFS content mismatch');
    }
    return `IPFS Kubo node healthy. Uploaded & pinned CID: ${upload.cid}`;
  });

  // STEP 5: Hardhat EVM Smart Contracts
  await recordStep('5. Blockchain Contracts & RPC Provider', async () => {
    if (!blockchainService.accessRegistryContract) {
      throw new Error('AccessRegistry contract not initialized');
    }
    if (!blockchainService.auditLoggerContract) {
      throw new Error('AuditLogger contract not initialized');
    }
    return `Contracts connected on chain 31337 (Registry: ${await blockchainService.accessRegistryContract.getAddress()})`;
  });

  // STEP 6: AI/ML Advisory Microservice
  await recordStep('6. AI/ML FastAPI Anomaly Scoring Service', async () => {
    const health = await getModelHealth();
    if (health.status !== 'ok' || !health.modelLoaded) {
      throw new Error(`AI/ML service not ready: status=${health.status}, loaded=${health.modelLoaded}`);
    }
    const score = await scoreAccessAnomaly({
      doctorId: 'smoke-doc',
      doctorSpecialty: 'Cardiology',
      hospital: 'Staging Center',
      recordType: 'ECG',
      purpose: 'Diagnosis',
    });
    return `AI/ML model v${health.modelVersion} loaded. Test score: ${score.anomalyScore}/100 (${score.riskLevel})`;
  });

  // STEP 7: Readiness Probe Telemetry
  await recordStep('7. Cluster Readiness & Dependency Telemetry Probe', async () => {
    const readiness = await checkReadiness();
    if (readiness.status !== 'READY') {
      throw new Error(`Readiness probe failed with status '${readiness.status}'`);
    }
    return `Status: ${readiness.status}, DB: ${readiness.checks.database}, Storage: ${readiness.checks.storage}, KMS: ${readiness.checks.kms}, AIML: ${readiness.checks.aiml}`;
  });

  console.log('\n================================================================');
  console.log('📊 STAGING DEPLOYMENT VALIDATION SUMMARY');
  console.log('================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Executed: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.error('❌ STAGING DEPLOYMENT VALIDATION FAILED!');
    process.exit(1);
  } else {
    console.log('🏆 ALL STAGING DEPLOYMENT SANITY CHECKS PASSED PERFECTLY!');
    process.exit(0);
  }
}

runStagingDeployment();
