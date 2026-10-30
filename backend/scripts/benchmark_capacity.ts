/**
 * Medrynx Platform - Synthetic Capacity & Performance Benchmark
 * 
 * Measures throughput and latency percentiles (p50, p90, p95, p99)
 * for key API endpoints under concurrent synthetic load.
 */

import request from 'supertest';
import { app } from '../src/app';
import { env } from '../src/config/env';

interface BenchmarkResult {
  endpoint: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  durationMs: number;
  rps: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
}

function calculatePercentile(latencies: number[], percentile: number): number {
  if (latencies.length === 0) return 0;
  latencies.sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * latencies.length) - 1;
  return latencies[Math.max(0, Math.min(index, latencies.length - 1))];
}

async function runBenchmark(
  name: string,
  totalRequests: number,
  concurrency: number,
  requestFn: () => Promise<number>
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let successful = 0;
  let failed = 0;
  const startTime = Date.now();

  let executed = 0;

  async function worker() {
    while (executed < totalRequests) {
      executed++;
      const reqStart = Date.now();
      try {
        const statusCode = await requestFn();
        const duration = Date.now() - reqStart;
        latencies.push(duration);
        if (statusCode >= 200 && statusCode < 400) {
          successful++;
        } else {
          failed++;
        }
      } catch (err) {
        failed++;
        latencies.push(Date.now() - reqStart);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalDurationMs = Date.now() - startTime;
  const rps = Math.round((totalRequests / (totalDurationMs / 1000)) * 100) / 100;
  const sum = latencies.reduce((acc, v) => acc + v, 0);

  return {
    endpoint: name,
    totalRequests,
    successfulRequests: successful,
    failedRequests: failed,
    durationMs: totalDurationMs,
    rps,
    minMs: Math.min(...latencies),
    maxMs: Math.max(...latencies),
    meanMs: Math.round((sum / latencies.length) * 100) / 100,
    p50Ms: calculatePercentile(latencies, 50),
    p90Ms: calculatePercentile(latencies, 90),
    p95Ms: calculatePercentile(latencies, 95),
    p99Ms: calculatePercentile(latencies, 99),
  };
}

async function main() {
  console.log('===============================================================');
  console.log('    MEDRYNX PHASE 15 — SYNTHETIC CAPACITY & LATENCY BENCHMARK   ');
  console.log('===============================================================\n');

  const results: BenchmarkResult[] = [];

  // Benchmark 1: Liveness Probe (/api/v1/health)
  console.log('Running Benchmark: GET /api/v1/health (150 requests, 10 concurrent)...');
  const healthRes = await runBenchmark('GET /api/v1/health', 150, 10, async () => {
    const res = await request(app).get('/api/v1/health');
    return res.status;
  });
  results.push(healthRes);

  // Benchmark 2: Deep Dependency Probe (/api/v1/health/dependencies)
  console.log('Running Benchmark: GET /api/v1/health/dependencies (50 requests, 5 concurrent)...');
  const depRes = await runBenchmark('GET /api/v1/health/dependencies', 50, 5, async () => {
    const res = await request(app)
      .get('/api/v1/health/dependencies')
      .set('X-Medrynx-Internal-Key', env.INTERNAL_SERVICE_KEY);
    return res.status;
  });
  results.push(depRes);

  // Benchmark 3: Metrics Scrape (/api/v1/metrics)
  console.log('Running Benchmark: GET /api/v1/metrics (100 requests, 10 concurrent)...');
  const metricsRes = await runBenchmark('GET /api/v1/metrics', 100, 10, async () => {
    const res = await request(app)
      .get('/api/v1/metrics')
      .set('X-Medrynx-Internal-Key', env.INTERNAL_SERVICE_KEY);
    return res.status;
  });
  results.push(metricsRes);

  // Benchmark 4: Ingress Auth Rejection Rate (Invalid credentials / rate limiting)
  console.log('Running Benchmark: Auth Rejection Under Load (100 requests, 10 concurrent)...');
  const authRes = await runBenchmark('POST /api/v1/auth/login (Invalid/RateLimited)', 100, 10, async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@medrynx.org', password: 'badpassword123' });
    // 401 (rejected credentials) or 429 (rate-limited) are expected secure behaviors
    return (res.status === 401 || res.status === 429) ? 200 : res.status;
  });
  results.push(authRes);

  console.log('\n===============================================================');
  console.log('                 BENCHMARK RESULTS SUMMARY                     ');
  console.log('===============================================================\n');

  console.table(results.map(r => ({
    'Endpoint': r.endpoint,
    'Requests': r.totalRequests,
    'Success': r.successfulRequests,
    'Failed': r.failedRequests,
    'RPS': r.rps,
    'p50 (ms)': r.p50Ms,
    'p90 (ms)': r.p90Ms,
    'p95 (ms)': r.p95Ms,
    'p99 (ms)': r.p99Ms,
    'Mean (ms)': r.meanMs
  })));

  console.log('\nCapacity benchmark completed successfully.\n');
}

main().catch(err => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
