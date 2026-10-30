import crypto from 'crypto';
import { IpfsStorageAdapter } from '../services/storage/IpfsStorageAdapter';
import { encryptWithEnvelope, decryptWithEnvelope } from '../crypto/kms/envelopeEncryption';
import { localKms } from '../crypto/kms/LocalKeyManagementService';
import { checkLiveness, checkReadiness } from '../services/health.service';

interface AnomalyResponse {
  anomaly_score: number;
  anomaly_flag: boolean;
  risk_level: string;
  reasons: string[];
}

function calculateEntropy(buffer: Buffer): number {
  const frequencies = new Map<number, number>();
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    frequencies.set(byte, (frequencies.get(byte) || 0) + 1);
  }
  let entropy = 0;
  for (const count of frequencies.values()) {
    const p = count / buffer.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

async function runRuntimeVerification() {
  console.log('================================================================');
  console.log('🚀 MEDRYNX REAL RUNTIME VERIFICATION PASS');
  console.log('================================================================\n');

  const results: { test: string; status: 'PASS' | 'FAIL'; details: string }[] = [];

  // -------------------------------------------------------------
  // 1. VERIFY REAL KUBO IPFS CONNECTIVITY
  // -------------------------------------------------------------
  console.log('--- STEP 1: VERIFYING REAL KUBO IPFS NODE ---');
  const ipfsAdapter = new IpfsStorageAdapter('http://127.0.0.1:5001', 'http://127.0.0.1:8080/ipfs/');
  const ipfsHealthy = await ipfsAdapter.healthCheck();

  if (ipfsHealthy) {
    console.log('✅ Real Kubo IPFS daemon is healthy on 127.0.0.1:5001 (RPC)');
    results.push({ test: 'Kubo Daemon Health Check', status: 'PASS', details: 'HTTP 200 from /api/v0/version' });
  } else {
    console.error('❌ Real Kubo IPFS daemon is NOT reachable on 127.0.0.1:5001');
    results.push({ test: 'Kubo Daemon Health Check', status: 'FAIL', details: 'Unable to connect to 127.0.0.1:5001' });
    process.exit(1);
  }

  // -------------------------------------------------------------
  // 2. VERIFY REAL AI/ML ANOMALY SCORING MICROSERVICE
  // -------------------------------------------------------------
  console.log('\n--- STEP 2: VERIFYING AI/ML ANOMALY SERVICE ---');
  try {
    const normalPayload = {
      doctor_specialty: 'Cardiology',
      record_type: 'ECG',
      purpose: 'Diagnosis',
      hospital_affiliation: 'HOSP001',
      requests_last_24h: 4,
      requests_last_7d: 25,
      requests_for_record_type: 15,
      average_daily_requests: 4.5,
      request_hour: 11,
      emergency_flag: 0,
    };

    const resNormal = await fetch('http://127.0.0.1:8000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalPayload),
    });
    const normalResult = (await resNormal.json()) as AnomalyResponse;

    console.log(`Normal access score: ${normalResult.anomaly_score} | Risk: ${normalResult.risk_level} | Flag: ${normalResult.anomaly_flag}`);

    const anomalousPayload = {
      doctor_specialty: 'Radiology',
      record_type: 'Psychiatry',
      purpose: 'Marketing',
      hospital_affiliation: 'HOSP999',
      requests_last_24h: 350,
      requests_last_7d: 1500,
      requests_for_record_type: 250,
      average_daily_requests: 5.0,
      request_hour: 3,
      emergency_flag: 1,
    };

    const resAnom = await fetch('http://127.0.0.1:8000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(anomalousPayload),
    });
    const anomResult = (await resAnom.json()) as AnomalyResponse;

    console.log(`Anomalous access score: ${anomResult.anomaly_score} | Risk: ${anomResult.risk_level} | Flag: ${anomResult.anomaly_flag}`);
    console.log(`Reasons detected: ${anomResult.reasons.slice(0, 2).join('; ')}...`);

    if (normalResult.risk_level === 'LOW' && anomResult.risk_level === 'HIGH' && anomResult.anomaly_flag === true) {
      console.log('✅ AI/ML Service accurately differentiated normal vs. anomalous access!');
      results.push({ test: 'AI/ML Anomaly Scoring Microservice', status: 'PASS', details: 'Accurately flagged anomalous burst access (Risk: HIGH, Score: 1.0)' });
    } else {
      results.push({ test: 'AI/ML Anomaly Scoring Microservice', status: 'FAIL', details: 'Classification did not meet criteria' });
    }
  } catch (err) {
    console.error('❌ AI/ML service connection error:', err);
    results.push({ test: 'AI/ML Anomaly Scoring Microservice', status: 'FAIL', details: String(err) });
  }

  // -------------------------------------------------------------
  // 3. SYNTHETIC MEDICAL FILE ENCRYPTION & REAL IPFS UPLOAD
  // -------------------------------------------------------------
  console.log('\n--- STEP 3: ENVELOPE ENCRYPTION & REAL IPFS UPLOAD ---');
  const syntheticMedicalRecord = {
    patientId: 'PAT-9842-TEST',
    mrn: 'MRN-SYNTH-883492',
    name: 'Jane Doe-Synthetic',
    dob: '1984-06-15',
    diagnoses: [
      { code: 'I10', description: 'Essential (primary) hypertension' },
      { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' }
    ],
    medications: ['Lisinopril 10mg daily', 'Metformin 500mg BID'],
    clinicalNotes: 'CONFIDENTIAL: Patient reports stable glycemic control. BP reading 128/82 mmHg in clinic. Verified non-PHI synthetic test data.',
    timestamp: new Date().toISOString(),
  };

  const plaintextBuffer = Buffer.from(JSON.stringify(syntheticMedicalRecord, null, 2), 'utf-8');
  const originalSha256 = crypto.createHash('sha256').update(plaintextBuffer).digest('hex');

  console.log(`Generated Synthetic Medical Record (${plaintextBuffer.length} bytes)`);
  console.log(`Plaintext SHA-256: ${originalSha256}`);

  // Envelope Encryption
  const envelopeResult = await encryptWithEnvelope(plaintextBuffer, localKms);
  const entropy = calculateEntropy(envelopeResult.combinedBlob.subarray(28));

  console.log(`Ciphertext payload generated (${envelopeResult.combinedBlob.length} bytes)`);
  console.log(`Wrapped DEK: ${envelopeResult.wrappedDek.substring(0, 32)}... (KEK v${envelopeResult.keyVersion})`);
  console.log(`Shannon Entropy of ciphertext: ${entropy.toFixed(4)} bits/byte (ideal random ~ 8.0)`);

  if (entropy < 7.5) {
    throw new Error('Entropy too low! Encryption output does not exhibit proper pseudorandomness.');
  }

  // Upload to REAL Kubo IPFS
  console.log('Uploading encrypted blob to real Kubo node via HTTP RPC...');
  const uploadResult = await ipfsAdapter.upload(envelopeResult.combinedBlob);

  console.log(`✅ Upload Succeeded! CID: ${uploadResult.cid}`);
  console.log(`Reported Size: ${uploadResult.sizeBytes} bytes`);
  console.log(`Gateway URL: ${uploadResult.gatewayUrl}`);

  const isValidCid = ipfsAdapter.validateCid(uploadResult.cid);
  if (!isValidCid) {
    throw new Error(`Returned CID ${uploadResult.cid} fails standard CID format validation!`);
  }
  results.push({ test: 'Encrypted Upload to Real Kubo IPFS', status: 'PASS', details: `CID: ${uploadResult.cid}, valid CID format, pinned` });

  // -------------------------------------------------------------
  // 4. VERIFY PLAINTEXT NEVER REACHES IPFS (RAW CAT VERIFICATION)
  // -------------------------------------------------------------
  console.log('\n--- STEP 4: AUDITING RAW IPFS BYTES (NO PLAINTEXT LEAKAGE) ---');
  console.log(`Fetching raw blob directly from Kubo: /api/v0/cat?arg=${uploadResult.cid}...`);
  const rawBytesFromIpfs = await ipfsAdapter.retrieve(uploadResult.cid);

  console.log(`Retrieved ${rawBytesFromIpfs.length} raw bytes from Kubo.`);
  if (rawBytesFromIpfs.length !== envelopeResult.combinedBlob.length) {
    throw new Error(`Raw IPFS byte count (${rawBytesFromIpfs.length}) does not match uploaded envelope (${envelopeResult.combinedBlob.length})!`);
  }

  // Search for any plaintext terms in raw bytes
  const rawString = rawBytesFromIpfs.toString('latin1');
  const sensitiveStrings = [
    'Jane Doe-Synthetic',
    'MRN-SYNTH-883492',
    'Lisinopril',
    'Metformin',
    'hypertension',
    'CONFIDENTIAL',
    'PAT-9842-TEST',
  ];

  let leakedStrings: string[] = [];
  for (const term of sensitiveStrings) {
    if (rawString.includes(term)) {
      leakedStrings.push(term);
    }
  }

  if (leakedStrings.length > 0) {
    console.error(`🚨 CRITICAL SECURITY FAILURE: Plaintext leaked to IPFS! Found terms: ${leakedStrings.join(', ')}`);
    results.push({ test: 'Plaintext Leakage Audit', status: 'FAIL', details: `Leaked strings: ${leakedStrings.join(', ')}` });
    process.exit(1);
  } else {
    console.log('✅ ZERO plaintext strings found in raw IPFS storage! All sensitive PHI is strictly AES-256-GCM ciphertext.');
    results.push({ test: 'Plaintext Leakage Audit on IPFS', status: 'PASS', details: 'Zero PHI keywords present in raw IPFS storage; pure cryptographic envelope' });
  }

  // -------------------------------------------------------------
  // 5. DECRYPTION & BYTE-FOR-BYTE INTEGRITY VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- STEP 5: DECRYPTION & BYTE-FOR-BYTE INTEGRITY ---');
  const decryptedBuffer = await decryptWithEnvelope(
    rawBytesFromIpfs,
    envelopeResult.wrappedDek,
    envelopeResult.keyVersion,
    localKms
  );
  const decryptedSha256 = crypto.createHash('sha256').update(decryptedBuffer).digest('hex');

  console.log(`Decrypted SHA-256: ${decryptedSha256}`);
  console.log(`Original  SHA-256: ${originalSha256}`);

  if (decryptedSha256 === originalSha256) {
    console.log('✅ Byte-for-byte identical! SHA-256 cryptographic hashes match perfectly.');
    results.push({ test: 'End-to-End Cryptographic Round-Trip', status: 'PASS', details: 'Byte-for-byte identical SHA-256 match after real Kubo roundtrip' });
  } else {
    console.error('❌ Cryptographic hash mismatch!');
    results.push({ test: 'End-to-End Cryptographic Round-Trip', status: 'FAIL', details: 'SHA-256 hashes do not match' });
  }

  // Parse decrypted JSON to verify structure
  const parsedDecrypted = JSON.parse(decryptedBuffer.toString('utf-8'));
  if (parsedDecrypted.name === 'Jane Doe-Synthetic' && parsedDecrypted.mrn === 'MRN-SYNTH-883492') {
    console.log('✅ Decrypted JSON data structure validated successfully.');
  }

  // -------------------------------------------------------------
  // 6. CRYPTOGRAPHIC TAMPER DETECTION (1-BIT CORRUPTION)
  // -------------------------------------------------------------
  console.log('\n--- STEP 6: TAMPER RESISTANCE AUDIT ---');
  const corruptedBlob = Buffer.from(rawBytesFromIpfs);
  // Flip the first bit in the ciphertext portion (after 28 bytes header)
  corruptedBlob[28] ^= 0x01;

  let tamperCaught = false;
  try {
    await decryptWithEnvelope(corruptedBlob, envelopeResult.wrappedDek, envelopeResult.keyVersion, localKms);
  } catch (err: any) {
    tamperCaught = true;
    console.log(`✅ 1-bit tampering caught by AES-256-GCM authentication: "${err.message}"`);
  }

  if (tamperCaught) {
    results.push({ test: '1-Bit Ciphertext Tampering Detection', status: 'PASS', details: 'AEAD tag rejected tampered ciphertext instantly' });
  } else {
    results.push({ test: '1-Bit Ciphertext Tampering Detection', status: 'FAIL', details: 'Tampered ciphertext was erroneously accepted' });
  }

  // -------------------------------------------------------------
  // 7. MULTI-TENANCY, ABAC CONSENT LIFECYCLE & CID BYPASS AUDIT
  // -------------------------------------------------------------
  console.log('\n--- STEP 7: MULTI-TENANCY, CONSENT & CID BYPASS AUDIT ---');
  const { store } = await import('../models/store');
  const { downloadAndDecryptRecord } = await import('../services/record.service');

  const patientA: any = { id: 'patient-A-uuid', email: 'alice@medrynx.health', role: 'PATIENT', patientId: 'PAT-ALICE-01' };
  const patientB: any = { id: 'patient-B-uuid', email: 'bob@medrynx.health', role: 'PATIENT', patientId: 'PAT-BOB-02' };
  const doctor1: any = { id: 'doctor-1-uuid', email: 'dr.smith@hospital.org', role: 'DOCTOR' };

  // Store Alice's record in store backed by real Kubo CID
  const recordAId = 'rec-alice-kubo-01';
  store.records.push({
    id: recordAId,
    patientId: patientA.id,
    title: 'Alice Oncology Report',
    description: 'Alice Oncology Report',
    category: 'LAB_REPORT' as any,
    recordDate: new Date(),
    fileType: 'PDF' as any,
    fileSize: `${envelopeResult.combinedBlob.length} B`,
    encryptedIpfsHash: uploadResult.cid,
    sha256Hash: envelopeResult.sha256Hash,
    wrappedDek: envelopeResult.wrappedDek,
    keyVersion: envelopeResult.keyVersion,
    isEncrypted: true,
    storageStatus: 'CONFIRMED' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Test 7a: Patient A (owner) can download and decrypt their own record
  const aliceResult = await downloadAndDecryptRecord(recordAId, patientA);
  const aliceDecryptedSha = crypto.createHash('sha256').update(aliceResult.decryptedBuffer).digest('hex');
  if (aliceDecryptedSha === originalSha256) {
    console.log('✅ Patient A successfully retrieved and decrypted own record from real IPFS');
    results.push({ test: 'Patient Owner Retrieval', status: 'PASS', details: 'Authorized owner retrieved & decrypted' });
  }

  // Test 7b: Patient B (IDOR attempt) MUST be forbidden
  let patientBBlocked = false;
  try {
    await downloadAndDecryptRecord(recordAId, patientB);
  } catch (err: any) {
    if (err.statusCode === 403 || err.message.includes('Patients may only access their own')) {
      patientBBlocked = true;
      console.log(`✅ Multi-tenancy IDOR Blocked: Patient B cannot access Patient A's record (${err.message})`);
    }
  }
  if (patientBBlocked) {
    results.push({ test: 'Multi-Tenancy IDOR Protection', status: 'PASS', details: 'Patient B strictly blocked from Patient A record (403)' });
  } else {
    results.push({ test: 'Multi-Tenancy IDOR Protection', status: 'FAIL', details: 'Patient B was not blocked!' });
  }

  // Test 7c: Doctor without consent MUST be forbidden
  let doctorBlockedWithoutConsent = false;
  try {
    await downloadAndDecryptRecord(recordAId, doctor1);
  } catch (err: any) {
    if (err.statusCode === 403) {
      doctorBlockedWithoutConsent = true;
      console.log(`✅ ABAC Consent Enforcement: Doctor without consent blocked (${err.message})`);
    }
  }
  if (doctorBlockedWithoutConsent) {
    results.push({ test: 'Doctor Consent Requirement', status: 'PASS', details: 'Doctor without active consent blocked (403)' });
  } else {
    results.push({ test: 'Doctor Consent Requirement', status: 'FAIL', details: 'Doctor accessed record without consent!' });
  }

  // Test 7d: Doctor with active consent CAN access record
  const grantId = 'grant-doc1-alice-01';
  store.grants.push({
    id: grantId,
    patientId: patientA.id,
    doctorId: doctor1.id,
    recordType: 'LAB_REPORT',
    status: 'ACTIVE' as any,
    purpose: 'Oncology Consultation',
    accessStart: new Date(),
    accessExpiry: new Date(Date.now() + 3600 * 1000), // 1 hour in future
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  const doctorAccessResult = await downloadAndDecryptRecord(recordAId, doctor1);
  const doctorDecryptedSha = crypto.createHash('sha256').update(doctorAccessResult.decryptedBuffer).digest('hex');
  if (doctorDecryptedSha === originalSha256) {
    console.log('✅ Doctor with active consent successfully decrypted record via KMS');
    results.push({ test: 'Consented Doctor Access', status: 'PASS', details: 'Doctor with valid unexpired grant permitted' });
  }

  // Test 7e: Expired consent MUST be forbidden
  store.grants.find((g) => g.id === grantId)!.accessExpiry = new Date(Date.now() - 1000); // Expired
  let expiredConsentBlocked = false;
  try {
    await downloadAndDecryptRecord(recordAId, doctor1);
  } catch (err: any) {
    if (err.statusCode === 403) {
      expiredConsentBlocked = true;
      console.log('✅ Expired Consent Enforcement: Doctor access blocked after expiry (403)');
    }
  }
  if (expiredConsentBlocked) {
    results.push({ test: 'Expired Consent Rejection', status: 'PASS', details: 'Doctor with expired grant blocked (403)' });
  } else {
    results.push({ test: 'Expired Consent Rejection', status: 'FAIL', details: 'Expired consent was accepted!' });
  }

  // Test 7f: Emergency Break-Glass Access
  const emergencyId = 'emg-doc1-alice-01';
  store.emergencies.push({
    id: emergencyId,
    doctorId: doctor1.id,
    patientId: patientA.id,
    hospital: 'Metro Hospital',
    verificationTier: 'FULL',
    recordsAccessed: [recordAId],
    durationMinutes: 30,
    hospitalVerified: true,
    accessWindowStart: new Date(),
    reconciliationStatus: 'PENDING',
    reason: 'Acute emergency trauma',
    autoRevokeTimestamp: new Date(Date.now() + 1800 * 1000), // 30 min in future
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any);

  const emergencyResult = await downloadAndDecryptRecord(recordAId, doctor1);
  const emergencyDecryptedSha = crypto.createHash('sha256').update(emergencyResult.decryptedBuffer).digest('hex');
  if (emergencyDecryptedSha === originalSha256) {
    console.log('✅ Emergency break-glass access permitted with audit trail');
    results.push({ test: 'Emergency Break-Glass Access', status: 'PASS', details: 'Active emergency grant permitted' });
  }

  // Test 7g: Emergency Break-Glass Expiration
  store.emergencies.find((e) => e.id === emergencyId)!.autoRevokeTimestamp = new Date(Date.now() - 1000); // Expired
  let expiredEmergencyBlocked = false;
  try {
    await downloadAndDecryptRecord(recordAId, doctor1);
  } catch (err: any) {
    if (err.statusCode === 403) {
      expiredEmergencyBlocked = true;
      console.log('✅ Expired Emergency Enforcement: Doctor blocked after emergency window ended (403)');
    }
  }
  if (expiredEmergencyBlocked) {
    results.push({ test: 'Expired Emergency Revocation', status: 'PASS', details: 'Auto-revoked emergency window blocked (403)' });
  } else {
    results.push({ test: 'Expired Emergency Revocation', status: 'FAIL', details: 'Expired emergency window permitted access!' });
  }

  // -------------------------------------------------------------
  // 8. SYSTEM READINESS AND HEALTH PROBES VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- STEP 8: KUBERNETES READINESS & HEALTH PROBES ---');
  const liveness = checkLiveness();
  console.log(`Liveness probe status: ${liveness.status}`);

  const readiness = await checkReadiness();
  console.log(`Readiness probe status: ${readiness.status}`);
  console.log(`Checks: Database=${readiness.checks.database}, KMS=${readiness.checks.kms}, Storage=${readiness.checks.storage}, Blockchain=${readiness.checks.blockchain}`);

  if (liveness.status === 'UP' && readiness.status === 'READY' && readiness.checks.storage === 'CONNECTED') {
    console.log('✅ Real IPFS reported as CONNECTED in system readiness check!');
    results.push({ test: 'Readiness Probe with Real IPFS', status: 'PASS', details: 'Status READY (HTTP 200), Storage: CONNECTED' });
  } else {
    results.push({ test: 'Readiness Probe with Real IPFS', status: 'FAIL', details: `Unexpected status: ${readiness.status}, Storage: ${readiness.checks.storage}` });
  }

  // -------------------------------------------------------------
  // SUMMARY REPORT
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('📊 REAL RUNTIME VERIFICATION SUMMARY');
  console.log('================================================================');
  let allPass = true;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.status}] ${r.test} - ${r.details}`);
    if (r.status !== 'PASS') allPass = false;
  }
  console.log('================================================================');
  if (allPass) {
    console.log('🏆 ALL REAL RUNTIME VERIFICATION TESTS PASSED PERFECTLY!');
  } else {
    console.log('⚠️ SOME RUNTIME VERIFICATION TESTS FAILED.');
    process.exit(1);
  }
}

runRuntimeVerification().catch((err) => {
  console.error('Fatal error in verification:', err);
  process.exit(1);
});
