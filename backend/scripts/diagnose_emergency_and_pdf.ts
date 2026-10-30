async function diagnose() {
  console.log('--- 1. Login as Dr. Marcus Vance ---');
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'doctor.vance@medrynx.org', password: 'SecurePass123!' }),
  });
  const loginJson = (await loginRes.json()) as any;
  console.log('Login status:', loginRes.status);
  const token = loginJson.data?.token;
  console.log('Doctor token obtained:', token ? 'YES' : 'NO');

  const headers = { Authorization: `Bearer ${token}` };

  console.log('--- 2. Call GET /api/v1/relationships/patients ---');
  const relRes = await fetch('http://localhost:5000/api/v1/relationships/patients', { headers });
  const relJson = (await relRes.json()) as any;
  console.log('Patients in directory:', relJson.data?.length);

  console.log('--- 3. Call GET /api/v1/emergency/active ---');
  const actRes = await fetch('http://localhost:5000/api/v1/emergency/active', { headers });
  const actJson = (await actRes.json()) as any;
  console.log('Active emergencies:', actJson.data?.length);

  console.log('--- 4. Declare Break-Glass Emergency for PT-1001 ---');
  const declRes = await fetch('http://localhost:5000/api/v1/emergency/declare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      patientId: 'PT-1001',
      tier: 'PARTIAL',
      reason: 'Urgent cardiac arrhythmia evaluation in ED',
    }),
  });
  const declJson = (await declRes.json()) as any;
  console.log('Declare response status:', declRes.status, 'Event ID:', declJson.data?.id);

  console.log('--- 5. Call GET /api/v1/emergency/active again ---');
  const actRes2 = await fetch('http://localhost:5000/api/v1/emergency/active', { headers });
  const actJson2 = (await actRes2.json()) as any;
  console.log('Active emergencies now:', actJson2.data?.length);

  console.log('--- 6. Call GET /api/v1/records ---');
  const recRes = await fetch('http://localhost:5000/api/v1/records', { headers });
  const recJson = (await recRes.json()) as any;
  console.log('Doctor records retrieved:', recJson.data?.length);

  console.log('--- 7. Call GET /api/v1/records?patientId=PT-1001 ---');
  const recResPt = await fetch('http://localhost:5000/api/v1/records?patientId=PT-1001', { headers });
  const recJsonPt = (await recResPt.json()) as any;
  console.log('Records for PT-1001 retrieved:', recJsonPt.data?.length);

  if (recJsonPt.data?.length > 0) {
    const rec = recJsonPt.data[0];
    console.log('--- 8. Test Download & Decrypt for record:', rec.id, rec.title, '---');
    const dlRes = await fetch(`http://localhost:5000/api/v1/records/${rec.id}/download`, { headers });
    console.log('Download status:', dlRes.status, 'Content-Type:', dlRes.headers.get('content-type'));
    const text = await dlRes.text();
    console.log('Decrypted text preview (first 100 chars):', text.slice(0, 100).replace(/\n/g, ' '));
  }

  console.log('--- 9. Test Patient Login (Aarav Sharma) ---');
  const ptLogin = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aarav.sharma@medrynx.org', password: 'SecurePass123!' }),
  });
  const ptJson = (await ptLogin.json()) as any;
  const ptToken = ptJson.data?.token;
  const ptHeaders = { Authorization: `Bearer ${ptToken}` };

  console.log('--- 10. Patient Records List ---');
  const ptRecs = await fetch('http://localhost:5000/api/v1/records', { headers: ptHeaders });
  const ptRecsJson = (await ptRecs.json()) as any;
  console.log('Patient records count:', ptRecsJson.data?.length);

  if (ptRecsJson.data?.length > 0) {
    const firstRec = ptRecsJson.data[0];
    console.log('--- 11. Patient Download Record:', firstRec.id, '---');
    const ptDl = await fetch(`http://localhost:5000/api/v1/records/${firstRec.id}/download`, {
      headers: ptHeaders,
    });
    console.log('Patient download status:', ptDl.status, 'Content-Type:', ptDl.headers.get('content-type'));
    const ptText = await ptDl.text();
    console.log('Patient report text preview (first 100 chars):', ptText.slice(0, 100).replace(/\n/g, ' '));
  }

  console.log('--- ALL DIAGNOSTIC CHECKS PASSED ---');
}

diagnose().catch((err) => {
  console.error('DIAGNOSTIC ERROR:', err);
});
