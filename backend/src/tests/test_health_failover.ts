import { checkReadiness, checkLiveness } from '../services/health.service';
import { defaultStorage } from '../services/storage';

async function testHealthFailover() {
  console.log('--- TESTING HEALTH PROBE BEHAVIOR WITH DAEMON ACTIVE ---');
  const initialReadiness = await checkReadiness();
  console.log(`Initial Readiness Status: ${initialReadiness.status}`);
  console.log(`Initial Storage Check: ${initialReadiness.checks.storage}`);

  if (initialReadiness.status !== 'READY' || initialReadiness.checks.storage !== 'CONNECTED') {
    throw new Error('Expected initial readiness to be READY with storage CONNECTED');
  }

  console.log('\n--- TESTING HEALTH PROBE WITH IPFS PORT UNREACHABLE (DEGRADED STATE) ---');
  // Temporarily configure an unreachable API URL on the ipfs adapter to simulate daemon failure
  const originalApiUrl = (defaultStorage as any).ipfsAdapter.apiUrl;
  (defaultStorage as any).ipfsAdapter.apiUrl = 'http://127.0.0.1:59999'; // unreachable port

  const degradedReadiness = await checkReadiness();
  console.log(`Degraded Readiness Status: ${degradedReadiness.status}`);
  console.log(`Degraded Storage Check: ${degradedReadiness.checks.storage}`);

  if (degradedReadiness.status !== 'DEGRADED' || degradedReadiness.checks.storage !== 'UNAVAILABLE') {
    throw new Error('Expected degraded readiness to be DEGRADED with storage UNAVAILABLE');
  }
  console.log('✅ Probe accurately detected IPFS daemon failure and switched to DEGRADED (HTTP 503)');

  console.log('\n--- TESTING HEALTH PROBE RECOVERY WHEN DAEMON RESTORED ---');
  (defaultStorage as any).ipfsAdapter.apiUrl = originalApiUrl; // restore original live Kubo node

  const recoveredReadiness = await checkReadiness();
  console.log(`Recovered Readiness Status: ${recoveredReadiness.status}`);
  console.log(`Recovered Storage Check: ${recoveredReadiness.checks.storage}`);

  if (recoveredReadiness.status !== 'READY' || recoveredReadiness.checks.storage !== 'CONNECTED') {
    throw new Error('Expected recovered readiness to be READY with storage CONNECTED');
  }
  console.log('✅ Probe accurately detected IPFS recovery and returned to READY (HTTP 200)');
  console.log('\n🏆 HEALTH PROBE FAILOVER AND RECOVERY VERIFIED SUCCESSFULLY!');
}

testHealthFailover().catch((err) => {
  console.error('Failover test error:', err);
  process.exit(1);
});
