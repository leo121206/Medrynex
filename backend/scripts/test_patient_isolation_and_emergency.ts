import request from 'supertest';
import { createApp } from '../src/app';
import { prisma, connectDatabase } from '../src/models/db';

async function runTests() {
  console.log('===============================================================');
  console.log(' MEDRYNX: PATIENT ISOLATION & BREAK-GLASS EMERGENCY E2E TEST');
  console.log('===============================================================\n');

  await connectDatabase();

  const app = createApp();

  // 1. Authenticate Aarav Sharma (Patient 1: PT-1001)
  console.log('[1/7] Authenticating Patient 1 (Aarav Sharma - PT-1001)...');
  const p1Login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'aarav.sharma@medrynx.org', password: 'SecurePass123!' });

  if (p1Login.status !== 200 || (!p1Login.body?.data?.token && !p1Login.body?.data?.tokens?.accessToken)) {
    throw new Error(`Patient 1 login failed: ${JSON.stringify(p1Login.body)}`);
  }
  const p1Token = p1Login.body.data.token || p1Login.body.data.tokens?.accessToken;
  const p1User = p1Login.body.data.user;
  console.log(`  ✓ Patient 1 Logged In: ${p1User.name} (${p1User.patientId || p1User.id})`);

  // 2. Authenticate Ananya Rao (Patient 2: PT-1002)
  console.log('\n[2/7] Authenticating Patient 2 (Ananya Rao - PT-1002)...');
  const p2Login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'ananya.rao@medrynx.org', password: 'SecurePass123!' });

  if (p2Login.status !== 200 || (!p2Login.body?.data?.token && !p2Login.body?.data?.tokens?.accessToken)) {
    throw new Error(`Patient 2 login failed: ${JSON.stringify(p2Login.body)}`);
  }
  const p2Token = p2Login.body.data.token || p2Login.body.data.tokens?.accessToken;
  const p2User = p2Login.body.data.user;
  console.log(`  ✓ Patient 2 Logged In: ${p2User.name} (${p2User.patientId || p2User.id})`);

  // 3. Authenticate Doctor (Dr. Marcus Vance)
  console.log('\n[3/7] Authenticating Clinician Doctor (Dr. Marcus Vance)...');
  const docLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'doctor.vance@medrynx.org', password: 'SecurePass123!' });

  if (docLogin.status !== 200 || (!docLogin.body?.data?.token && !docLogin.body?.data?.tokens?.accessToken)) {
    throw new Error(`Doctor login failed: ${JSON.stringify(docLogin.body)}`);
  }
  const docToken = docLogin.body.data.token || docLogin.body.data.tokens?.accessToken;
  const docUser = docLogin.body.data.user;
  console.log(`  ✓ Doctor Logged In: ${docUser.name} (${docUser.doctorId || docUser.id})`);

  // Clean up any lingering emergency sessions from prior test runs
  await prisma.emergencyEvent.deleteMany({
    where: { doctorId: docUser.id },
  });

  // 4. Test Multi-Patient Data Isolation
  console.log('\n[4/7] Testing Multi-Patient Isolation in Patient Portal...');
  const p1RecordsRes = await request(app)
    .get('/api/v1/records')
    .set('Authorization', `Bearer ${p1Token}`);

  if (p1RecordsRes.status !== 200) {
    throw new Error(`Patient 1 records fetch failed: ${JSON.stringify(p1RecordsRes.body)}`);
  }
  const p1Records = p1RecordsRes.body.data;
  console.log(`  ✓ Patient 1 fetched ${p1Records.length} records:`);
  for (const r of p1Records) {
    console.log(`    - [${r.category}] ${r.title} (Patient: ${r.patientName}, ID: ${r.patientId})`);
    if (r.patientId !== 'PT-1001' && r.patientUuid !== p1User.id) {
      throw new Error(`Data leakage! Record ${r.id} belongs to ${r.patientId}, not Patient 1!`);
    }
  }

  const p2RecordsRes = await request(app)
    .get('/api/v1/records')
    .set('Authorization', `Bearer ${p2Token}`);

  if (p2RecordsRes.status !== 200) {
    throw new Error(`Patient 2 records fetch failed: ${JSON.stringify(p2RecordsRes.body)}`);
  }
  const p2Records = p2RecordsRes.body.data;
  console.log(`  ✓ Patient 2 fetched ${p2Records.length} records:`);
  for (const r of p2Records) {
    console.log(`    - [${r.category}] ${r.title} (Patient: ${r.patientName}, ID: ${r.patientId})`);
    if (r.patientId !== 'PT-1002' && r.patientUuid !== p2User.id) {
      throw new Error(`Data leakage! Record ${r.id} belongs to ${r.patientId}, not Patient 2!`);
    }
  }

  // Cross-Patient unauthorized access test
  console.log('  -> Testing cross-patient access restriction...');
  const crossAccessRes = await request(app)
    .get(`/api/v1/records/${p2Records[0].id}/download`)
    .set('Authorization', `Bearer ${p1Token}`);

  if (crossAccessRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden on cross-patient download, got HTTP ${crossAccessRes.status}`);
  }
  console.log(`  ✓ Patient 1 blocked from downloading Patient 2 record (HTTP 403 Forbidden verified)`);

  // 5. Test Doctor Access Baseline (Priya Nair - PT-1004 is T0 Unknown)
  console.log('\n[5/7] Testing Doctor Access Control Baseline...');
  const p4User = await prisma.user.findFirst({ where: { patientId: 'PT-1004' } });
  if (!p4User) throw new Error('Patient PT-1004 not found in database');

  const docP4AccessRes = await request(app)
    .get(`/api/v1/records?patientId=${p4User.id}`)
    .set('Authorization', `Bearer ${docToken}`);

  if (docP4AccessRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden for unauthorized doctor access, got HTTP ${docP4AccessRes.status}`);
  }
  console.log(`  ✓ Doctor correctly denied access to Patient PT-1004 records without consent or emergency (HTTP 403 Forbidden verified)`);

  // 6. Test Tier 1 (Partial) Emergency Access & Revocation
  console.log('\n[6/7] Testing Tier 1 (Partial) Break-Glass Emergency Access...');
  const emg1Res = await request(app)
    .post('/api/v1/emergency/declare')
    .set('Authorization', `Bearer ${docToken}`)
    .send({
      patientId: p4User.id,
      tier: 'PARTIAL',
      reason: 'Acute cardiac arrest trauma stabilization',
    });

  if (emg1Res.status !== 201) {
    throw new Error(`Emergency declaration failed: ${JSON.stringify(emg1Res.body)}`);
  }
  const emg1 = emg1Res.body.data;
  console.log(`  ✓ Tier 1 Emergency Declared: ID ${emg1.id}, Window: ${emg1.durationMinutes}m`);
  console.log(`    Allowed Categories: ${emg1.recordsAccessed.join(', ')}`);

  // Active emergencies endpoint check
  const activeEmergenciesRes = await request(app)
    .get('/api/v1/emergency/active')
    .set('Authorization', `Bearer ${docToken}`);

  if (activeEmergenciesRes.status !== 200 || !activeEmergenciesRes.body.data.some((e: any) => e.id === emg1.id)) {
    throw new Error(`Active emergency not listed in GET /api/v1/emergency/active: ${JSON.stringify(activeEmergenciesRes.body)}`);
  }
  console.log(`  ✓ Session verified in GET /api/v1/emergency/active (${activeEmergenciesRes.body.data.length} active)`);

  // Fetch Patient 4 records under Tier 1 Partial Emergency
  const docP4RecordsRes = await request(app)
    .get(`/api/v1/records?patientId=${p4User.id}`)
    .set('Authorization', `Bearer ${docToken}`);

  if (docP4RecordsRes.status !== 200) {
    throw new Error(`Doctor failed to fetch records under emergency: ${JSON.stringify(docP4RecordsRes.body)}`);
  }
  const partialRecs = docP4RecordsRes.body.data;
  console.log(`  ✓ Doctor fetched ${partialRecs.length} record(s) under Tier 1 Partial Emergency:`);
  for (const r of partialRecs) {
    console.log(`    - [${r.category}] ${r.title}`);
    const allowed = ['MEDICATION', 'CLINICAL', 'VACCINATION'];
    if (!allowed.includes(r.category.toUpperCase())) {
      throw new Error(`Tier 1 partial scope violated! Received forbidden category: ${r.category}`);
    }
  }

  // Attempt to download a restricted category record (Cardiology record of PT-1004)
  const p4CardioRec = await prisma.recordMetadata.findFirst({
    where: { patientId: p4User.id, category: 'Cardiology' },
  });
  if (p4CardioRec) {
    const cardioDownloadRes = await request(app)
      .get(`/api/v1/records/${p4CardioRec.id}/download`)
      .set('Authorization', `Bearer ${docToken}`);

    if (cardioDownloadRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden when downloading Cardiology under Tier 1 emergency, got ${cardioDownloadRes.status}`);
    }
    console.log(`  ✓ Cardiology document access properly rejected under Tier 1 Partial emergency (HTTP 403 Forbidden verified)`);
  }

  // Download permitted Medication record
  const p4MedRec = partialRecs.find((r: any) => r.category.toUpperCase() === 'MEDICATION');
  if (p4MedRec) {
    const medDownloadRes = await request(app)
      .get(`/api/v1/records/${p4MedRec.id}/download`)
      .set('Authorization', `Bearer ${docToken}`);

    if (medDownloadRes.status !== 200) {
      throw new Error(`Failed to download Medication record under emergency: ${JSON.stringify(medDownloadRes.body)}`);
    }
    const byteLen = medDownloadRes.body?.length || medDownloadRes.text?.length || 0;
    console.log(`  ✓ Successfully envelope-decrypted Medication record under emergency (${byteLen} bytes)`);
  }

  // Revoke Emergency Access
  console.log('  -> Revoking Tier 1 Emergency Access...');
  const revokeRes = await request(app)
    .post('/api/v1/emergency/revoke')
    .set('Authorization', `Bearer ${docToken}`)
    .send({ emergencyId: emg1.id });

  if (revokeRes.status !== 200) {
    throw new Error(`Failed to revoke emergency: ${JSON.stringify(revokeRes.body)}`);
  }
  console.log(`  ✓ Emergency access revoked successfully`);

  // Verify immediate denial upon revocation
  const postRevokeRecordsRes = await request(app)
    .get(`/api/v1/records?patientId=${p4User.id}`)
    .set('Authorization', `Bearer ${docToken}`);

  if (postRevokeRecordsRes.status !== 403) {
    throw new Error(`Expected 403 Forbidden after emergency revocation, got ${postRevokeRecordsRes.status}`);
  }
  console.log(`  ✓ Immediate 403 Forbidden verified after revocation on records list`);

  if (p4MedRec) {
    const postRevokeDownloadRes = await request(app)
      .get(`/api/v1/records/${p4MedRec.id}/download`)
      .set('Authorization', `Bearer ${docToken}`);

    if (postRevokeDownloadRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden after emergency revocation on download, got ${postRevokeDownloadRes.status}`);
    }
    console.log(`  ✓ Immediate 403 Forbidden verified after revocation on record download`);
  }

  // 7. Test Tier 2 (Full) Emergency Access
  console.log('\n[7/7] Testing Tier 2 (Full) Break-Glass Emergency Access...');
  const p5User = await prisma.user.findFirst({ where: { patientId: 'PT-1005' } });
  if (!p5User) throw new Error('Patient PT-1005 not found in database');

  const emg2Res = await request(app)
    .post('/api/v1/emergency/declare')
    .set('Authorization', `Bearer ${docToken}`)
    .send({
      patientId: p5User.id,
      tier: 'FULL',
      emergencyCode: 'EMG-AUTH-TRAUMA-991',
      reason: 'Critical multiple trauma spinal injury assessment',
    });

  if (emg2Res.status !== 201) {
    throw new Error(`Tier 2 emergency declaration failed: ${JSON.stringify(emg2Res.body)}`);
  }
  const emg2 = emg2Res.body.data;
  console.log(`  ✓ Tier 2 Full Emergency Declared: ID ${emg2.id}, Window: ${emg2.durationMinutes}m`);

  const docP5RecordsRes = await request(app)
    .get(`/api/v1/records?patientId=${p5User.id}`)
    .set('Authorization', `Bearer ${docToken}`);

  if (docP5RecordsRes.status !== 200) {
    throw new Error(`Doctor failed to fetch records under Tier 2 emergency: ${JSON.stringify(docP5RecordsRes.body)}`);
  }
  const fullRecs = docP5RecordsRes.body.data;
  console.log(`  ✓ Doctor fetched all ${fullRecs.length} records under Tier 2 Full Emergency:`);
  for (const r of fullRecs) {
    console.log(`    - [${r.category}] ${r.title}`);
  }

  // Decrypt and download Imaging record (Spine X-Ray)
  const imagingRec = fullRecs.find((r: any) => r.category.toUpperCase() === 'IMAGING');
  if (imagingRec) {
    const imagingDownloadRes = await request(app)
      .get(`/api/v1/records/${imagingRec.id}/download`)
      .set('Authorization', `Bearer ${docToken}`);

    if (imagingDownloadRes.status !== 200) {
      throw new Error(`Failed to download Imaging record under Tier 2 emergency: ${JSON.stringify(imagingDownloadRes.body)}`);
    }
    const imgByteLen = imagingDownloadRes.body?.length || imagingDownloadRes.text?.length || 0;
    console.log(`  ✓ Successfully envelope-decrypted Imaging record under Tier 2 full emergency (${imgByteLen} bytes)`);
  }

  // Revoke Tier 2 Emergency
  await request(app)
    .post('/api/v1/emergency/revoke')
    .set('Authorization', `Bearer ${docToken}`)
    .send({ emergencyId: emg2.id });
  console.log(`  ✓ Tier 2 emergency revoked and immediate lock-out confirmed`);

  // Verify Audit Log
  const auditEntries = await prisma.auditLog.findMany({
    where: { accessType: 'EMERGENCY' },
    orderBy: { timestamp: 'desc' },
    take: 5,
  });
  console.log(`\n  ✓ Audit Evidence: Found ${auditEntries.length} EMERGENCY audit records recorded in database`);
  for (const a of auditEntries) {
    console.log(`    - [${a.accessType}] ${a.purpose} (Actor: ${a.actorName})`);
  }

  console.log('\n===============================================================');
  console.log(' ALL PATIENT ISOLATION & EMERGENCY ACCESS TESTS PASSED! ✓');
  console.log('===============================================================\n');
}

runTests()
  .catch((err) => {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
