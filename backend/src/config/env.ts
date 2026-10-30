import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DEV_DEFAULT_JWT_SECRET = 'medrynx_super_secret_jwt_key_2026_change_in_production';
const DEV_DEFAULT_AES_KEY = 'e4d909c290d0fb1ca068ffaddf22cbd0ffd83296c09dfb32525501869f06e0a3';
const HARDHAT_PUBLIC_TEST_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/medrynx_db?schema=public'),
  JWT_SECRET: z.string().default(DEV_DEFAULT_JWT_SECRET),
  JWT_EXPIRES_IN: z.string().default('7d'),
  AES_SECRET_KEY: z.string().default(DEV_DEFAULT_AES_KEY),
  GANACHE_RPC_URL: z.string().default(process.env.BLOCKCHAIN_RPC_URL || process.env.GANACHE_RPC_URL || 'http://127.0.0.1:8545'),
  CONTRACT_ADDRESS: z.string().optional().default(''),
  DEPLOYER_PRIVATE_KEY: z.string().optional().default(''),
  IPFS_API_URL: z.string().default('http://127.0.0.1:5001'),
  IPFS_GATEWAY_URL: z.string().default('https://ipfs.io/ipfs/'),
  IPFS_MOCK_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  ML_SCORING_URL: z.string().default(process.env.ML_SCORING_URL || 'http://localhost:8000/predict'),
  ANOMALY_THRESHOLD: z.coerce.number().default(65),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:3000,http://localhost:80'),
  // FRONTEND_URL allows setting the deployed frontend origin in production (e.g. Vercel/Netlify URL)
  FRONTEND_URL: z.string().optional(),
  INTERNAL_SERVICE_KEY: z.string().default('medrynx-internal-dev-service-key-2026'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000), // 1 minute
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(300), // 300 requests per minute
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(20),     // 20 auth attempts per minute
  REQUEST_TIMEOUT_MS: z.coerce.number().default(15000),    // 15 seconds
});

/**
 * Validates production environment constraints.
 * Throws explicit errors if insecure defaults or missing secrets are detected.
 */
export function validateProductionConfig(config: z.infer<typeof envSchema>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.NODE_ENV === 'production') {
    // 1. JWT Secret Hardening
    if (!config.JWT_SECRET || config.JWT_SECRET === DEV_DEFAULT_JWT_SECRET) {
      errors.push('CRITICAL: JWT_SECRET must be set to a secure production secret and cannot use the development default.');
    }
    if (config.JWT_SECRET && config.JWT_SECRET.length < 32) {
      errors.push('CRITICAL: JWT_SECRET must be at least 32 characters in length for production security.');
    }

    // 2. KMS AES Secret Key Hardening
    if (!config.AES_SECRET_KEY || config.AES_SECRET_KEY === DEV_DEFAULT_AES_KEY) {
      errors.push('CRITICAL: AES_SECRET_KEY must be set to a unique 256-bit hexadecimal key in production, not the development placeholder.');
    }
    if (config.AES_SECRET_KEY && config.AES_SECRET_KEY.length !== 64) {
      errors.push('CRITICAL: AES_SECRET_KEY must be a 64-character hexadecimal string (256 bits).');
    }

    // 3. IPFS Production Storage
    if (config.IPFS_MOCK_ENABLED) {
      errors.push('CRITICAL: IPFS_MOCK_ENABLED must be false in production. Real content-addressed storage required.');
    }

    // 4. Blockchain Key Protection
    if (config.DEPLOYER_PRIVATE_KEY && config.DEPLOYER_PRIVATE_KEY.toLowerCase() === HARDHAT_PUBLIC_TEST_KEY.toLowerCase()) {
      errors.push('CRITICAL: DEPLOYER_PRIVATE_KEY is set to a well-known public Hardhat test account key. This is forbidden in production.');
    }

    // 5. Internal Service Authentication
    if (!config.INTERNAL_SERVICE_KEY || config.INTERNAL_SERVICE_KEY === 'medrynx-internal-dev-service-key-2026') {
      errors.push('CRITICAL: INTERNAL_SERVICE_KEY must be set to a unique production shared secret for microservice authentication.');
    }

    // 6. CORS Policy
    if (config.CORS_ORIGIN.includes('*')) {
      errors.push('CRITICAL: CORS_ORIGIN cannot contain wildcard (*) in production when credentials are enabled.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

// In production, execute strict validation
if (parsed.data.NODE_ENV === 'production') {
  const prodCheck = validateProductionConfig(parsed.data);
  if (!prodCheck.valid) {
    console.error('❌ Production configuration validation failed:');
    prodCheck.errors.forEach((err) => console.error(`  - ${err}`));
    // In production startup, prevent running with insecure defaults
    if (process.env.STRICT_PROD_ENFORCE === 'true') {
      process.exit(1);
    }
  }
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
