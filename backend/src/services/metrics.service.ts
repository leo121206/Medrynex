/**
 * MEDRYNX — IN-MEMORY METRICS REGISTRY & EXPORTER
 * Zero-dependency, lightweight, production-safe time-series telemetry.
 * Strictly enforces zero-PHI: NO user IDs, record IDs, or patient data in labels.
 */

export interface MetricLabels {
  [key: string]: string | number;
}

export interface MetricSummary {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  values: Array<{
    labels: MetricLabels;
    value: number;
  }>;
}

class MetricsRegistry {
  private requestCounters: Map<string, number> = new Map();
  private errorCounters: Map<string, number> = new Map();
  private durationSum: Map<string, number> = new Map();
  private durationCount: Map<string, number> = new Map();

  private kmsCounters: Map<string, number> = new Map();
  private storageCounters: Map<string, number> = new Map();
  private blockchainCounters: Map<string, number> = new Map();
  private aimlCounters: Map<string, number> = new Map();
  private authFailureCounters: Map<string, number> = new Map();
  private rateLimitHits: Map<string, number> = new Map();

  /**
   * Sanitizes a dynamic URL path into a static route template to prevent high-cardinality explosion.
   * e.g. /api/v1/records/rec-12345-uuid -> /api/v1/records/:id
   */
  public sanitizeRoute(url: string): string {
    return url
      .split('?')[0]
      .replace(/\/rec-[a-zA-Z0-9_-]+/g, '/:recordId')
      .replace(/\/user-[a-zA-Z0-9_-]+/g, '/:userId')
      .replace(/\/doc-[a-zA-Z0-9_-]+/g, '/:docId')
      .replace(/\/pat-[a-zA-Z0-9_-]+/g, '/:patientId')
      .replace(/\/0x[a-fA-F0-9]{40,64}/g, '/:addressOrHash')
      .replace(/\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '/:uuid');
  }

  public recordHttpRequest(method: string, route: string, statusCode: number, durationMs: number): void {
    const statusClass = `${Math.floor(statusCode / 100)}xx`;
    const cleanRoute = this.sanitizeRoute(route);
    const key = `method="${method}",status="${statusClass}",route="${cleanRoute}"`;

    this.requestCounters.set(key, (this.requestCounters.get(key) || 0) + 1);

    // Duration sum & count
    const durationKey = `method="${method}",route="${cleanRoute}"`;
    this.durationSum.set(durationKey, (this.durationSum.get(durationKey) || 0) + durationMs);
    this.durationCount.set(durationKey, (this.durationCount.get(durationKey) || 0) + 1);

    if (statusCode >= 400) {
      const errKey = `status="${statusCode}",route="${cleanRoute}"`;
      this.errorCounters.set(errKey, (this.errorCounters.get(errKey) || 0) + 1);
    }
  }

  public recordError(errorType: string): void {
    const key = `type="${errorType}"`;
    this.errorCounters.set(key, (this.errorCounters.get(key) || 0) + 1);
  }

  public recordAuthFailure(reason: string): void {
    const key = `reason="${reason}"`;
    this.authFailureCounters.set(key, (this.authFailureCounters.get(key) || 0) + 1);
  }

  public recordKmsOperation(operation: 'wrap' | 'unwrap' | 'rotate' | 'rewrap', status: 'success' | 'error'): void {
    const key = `operation="${operation}",status="${status}"`;
    this.kmsCounters.set(key, (this.kmsCounters.get(key) || 0) + 1);
  }

  public recordStorageOperation(operation: 'upload' | 'retrieve' | 'pin' | 'unpin', status: 'success' | 'error'): void {
    const key = `operation="${operation}",status="${status}"`;
    this.storageCounters.set(key, (this.storageCounters.get(key) || 0) + 1);
  }

  public recordBlockchainEvent(action: string, status: 'success' | 'reverted' | 'error'): void {
    const key = `action="${action}",status="${status}"`;
    this.blockchainCounters.set(key, (this.blockchainCounters.get(key) || 0) + 1);
  }

  public recordAimlInference(status: 'success' | 'fallback' | 'error', riskLevel?: string): void {
    const key = `status="${status}",risk="${riskLevel || 'UNKNOWN'}"`;
    this.aimlCounters.set(key, (this.aimlCounters.get(key) || 0) + 1);
  }

  public recordRateLimitHit(endpoint: string): void {
    const cleanRoute = this.sanitizeRoute(endpoint);
    const key = `endpoint="${cleanRoute}"`;
    this.rateLimitHits.set(key, (this.rateLimitHits.get(key) || 0) + 1);
  }

  public getMetricsJson() {
    const memory = process.memoryUsage();
    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      system: {
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
        rssBytes: memory.rss,
        externalBytes: memory.external,
      },
      http: {
        requests: Object.fromEntries(this.requestCounters),
        errors: Object.fromEntries(this.errorCounters),
        durations: Array.from(this.durationCount.entries()).map(([key, count]) => {
          const sum = this.durationSum.get(key) || 0;
          return {
            target: key,
            count,
            sumMs: sum,
            avgMs: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
          };
        }),
      },
      security: {
        authFailures: Object.fromEntries(this.authFailureCounters),
        rateLimitHits: Object.fromEntries(this.rateLimitHits),
      },
      subsystems: {
        kms: Object.fromEntries(this.kmsCounters),
        storage: Object.fromEntries(this.storageCounters),
        blockchain: Object.fromEntries(this.blockchainCounters),
        aiml: Object.fromEntries(this.aimlCounters),
      },
    };
  }

  public getPrometheusFormat(): string {
    const lines: string[] = [];

    lines.push('# HELP medrynx_http_requests_total Total number of HTTP requests processed');
    lines.push('# TYPE medrynx_http_requests_total counter');
    for (const [labels, val] of this.requestCounters.entries()) {
      lines.push(`medrynx_http_requests_total{${labels}} ${val}`);
    }

    lines.push('# HELP medrynx_http_request_duration_ms_sum Total milliseconds spent processing requests');
    lines.push('# TYPE medrynx_http_request_duration_ms_sum counter');
    for (const [labels, val] of this.durationSum.entries()) {
      lines.push(`medrynx_http_request_duration_ms_sum{${labels}} ${val}`);
    }

    lines.push('# HELP medrynx_http_request_duration_ms_count Count of requests measured for duration');
    lines.push('# TYPE medrynx_http_request_duration_ms_count counter');
    for (const [labels, val] of this.durationCount.entries()) {
      lines.push(`medrynx_http_request_duration_ms_count{${labels}} ${val}`);
    }

    lines.push('# HELP medrynx_kms_operations_total Total cryptographic operations performed by KMS');
    lines.push('# TYPE medrynx_kms_operations_total counter');
    for (const [labels, val] of this.kmsCounters.entries()) {
      lines.push(`medrynx_kms_operations_total{${labels}} ${val}`);
    }

    lines.push('# HELP medrynx_storage_operations_total Total IPFS storage operations performed');
    lines.push('# TYPE medrynx_storage_operations_total counter');
    for (const [labels, val] of this.storageCounters.entries()) {
      lines.push(`medrynx_storage_operations_total{${labels}} ${val}`);
    }

    lines.push('# HELP medrynx_blockchain_events_total Total blockchain evidence events anchored');
    lines.push('# TYPE medrynx_blockchain_events_total counter');
    for (const [labels, val] of this.blockchainCounters.entries()) {
      lines.push(`medrynx_blockchain_events_total{${labels}} ${val}`);
    }

    lines.push('# HELP medrynx_aiml_inferences_total Total access requests scored by AI/ML microservice');
    lines.push('# TYPE medrynx_aiml_inferences_total counter');
    for (const [labels, val] of this.aimlCounters.entries()) {
      lines.push(`medrynx_aiml_inferences_total{${labels}} ${val}`);
    }

    const memory = process.memoryUsage();
    lines.push('# HELP medrynx_process_heap_bytes Process heap memory usage in bytes');
    lines.push('# TYPE medrynx_process_heap_bytes gauge');
    lines.push(`medrynx_process_heap_bytes ${memory.heapUsed}`);

    return lines.join('\n') + '\n';
  }

  public reset(): void {
    this.requestCounters.clear();
    this.errorCounters.clear();
    this.durationSum.clear();
    this.durationCount.clear();
    this.kmsCounters.clear();
    this.storageCounters.clear();
    this.blockchainCounters.clear();
    this.aimlCounters.clear();
    this.authFailureCounters.clear();
    this.rateLimitHits.clear();
  }
}

export const metricsRegistry = new MetricsRegistry();
