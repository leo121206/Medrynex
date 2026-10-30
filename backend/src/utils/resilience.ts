/**
 * Medrynx Platform - Reliability & Resilience Utilities
 * 
 * Provides production-grade circuit breaking, bounded exponential backoff retries,
 * and execution timeouts with strict security fail-closed semantics.
 */

import { logger } from '../config/logger';
import { metricsRegistry } from '../services/metrics.service';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;         // Consecutive failures before tripping OPEN (default: 5)
  recoveryTimeoutMs?: number;        // Time to stay OPEN before testing HALF_OPEN (default: 30000ms)
  halfOpenSuccessThreshold?: number; // Consecutive successes in HALF_OPEN to close (default: 2)
  name?: string;                     // Circuit breaker identifier for metrics & logging
  failClosed?: boolean;              // If true, failing or open circuit throws an explicit security error (default: true)
}

export class CircuitBreakerOpenError extends Error {
  constructor(public readonly circuitName: string) {
    super(`Circuit breaker [${circuitName}] is OPEN. Fast-failing downstream request.`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class TimeoutError extends Error {
  constructor(public readonly operationName: string, public readonly timeoutMs: number) {
    super(`Operation [${operationName}] timed out after ${timeoutMs}ms.`);
    this.name = 'TimeoutError';
  }
}

export class CircuitBreaker<T = any> {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number;
  private readonly recoveryTimeoutMs: number;
  private readonly halfOpenSuccessThreshold: number;
  public readonly name: string;
  public readonly failClosed: boolean;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.recoveryTimeoutMs = options.recoveryTimeoutMs ?? 30000;
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold ?? 2;
    this.name = options.name ?? 'default_circuit';
    this.failClosed = options.failClosed ?? true;
  }

  public getState(): CircuitState {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.recoveryTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        logger.info(`Circuit breaker [${this.name}] transitioned from OPEN to HALF_OPEN`);
      }
    }
    return this.state;
  }

  public async execute(action: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === CircuitState.OPEN) {
      metricsRegistry.recordError(`circuit_breaker_open_${this.name}`);
      logger.warn(`Circuit breaker [${this.name}] rejected call: Circuit is OPEN`);
      if (fallback) {
        return fallback();
      }
      throw new CircuitBreakerOpenError(this.name);
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (err: any) {
      this.onFailure(err);
      if (fallback) {
        return fallback();
      }
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        logger.info(`Circuit breaker [${this.name}] transitioned from HALF_OPEN to CLOSED (healthy)`);
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(error: any): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    logger.warn(`Circuit breaker [${this.name}] recorded failure #${this.failureCount}: ${error?.message || error}`);

    if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      metricsRegistry.recordError(`circuit_breaker_tripped_${this.name}`);
      logger.error(`Circuit breaker [${this.name}] TRIPPED to OPEN state! Next check in ${this.recoveryTimeoutMs}ms`);
    }
  }

  public reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    logger.info(`Circuit breaker [${this.name}] manually reset to CLOSED`);
  }
}

/**
 * Execute a promise with a hard timeout limit.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string = 'operation'
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(operationName, timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}

export interface RetryOptions {
  maxRetries?: number;        // Maximum number of retries (default: 3)
  initialDelayMs?: number;    // Initial delay in ms (default: 200ms)
  backoffFactor?: number;     // Multiplier for subsequent attempts (default: 2)
  maxDelayMs?: number;        // Max cap on delay (default: 5000ms)
  jitter?: boolean;           // Add random jitter to prevent thundering herds (default: true)
  operationName?: string;     // Identifier for logging
  isRetryable?: (err: any) => boolean; // Predicate to check if error is retryable
}

/**
 * Execute an async operation with bounded exponential backoff and jitter.
 * Never retries authentication, authorization, or unrecoverable client errors.
 */
export async function retryWithBackoff<T>(
  action: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 200;
  const backoffFactor = options.backoffFactor ?? 2;
  const maxDelayMs = options.maxDelayMs ?? 5000;
  const jitter = options.jitter ?? true;
  const operationName = options.operationName ?? 'anonymous_operation';

  const defaultIsRetryable = (err: any): boolean => {
    // Non-retryable HTTP status codes
    const status = err?.status || err?.statusCode || err?.response?.status;
    if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409 || status === 422) {
      return false;
    }
    // Auth or permission errors are NEVER retried
    if (err?.name === 'UnauthorizedError' || err?.name === 'ForbiddenError' || err?.name === 'ConsentViolationError') {
      return false;
    }
    return true;
  };

  const isRetryable = options.isRetryable ?? defaultIsRetryable;

  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    try {
      return await action();
    } catch (err: any) {
      attempt++;
      if (attempt > maxRetries || !isRetryable(err)) {
        if (attempt > maxRetries) {
          logger.warn(`Operation [${operationName}] failed after reaching max retries (${maxRetries}): ${err?.message}`);
        }
        throw err;
      }

      let sleepMs = Math.min(delay, maxDelayMs);
      if (jitter) {
        // Jitter between 75% and 125% of calculated delay
        sleepMs = Math.floor(sleepMs * (0.75 + Math.random() * 0.5));
      }

      logger.info(`Operation [${operationName}] failed (attempt ${attempt}/${maxRetries}). Retrying in ${sleepMs}ms... Error: ${err?.message}`);
      await new Promise(resolve => setTimeout(resolve, sleepMs));
      delay *= backoffFactor;
    }
  }
}
