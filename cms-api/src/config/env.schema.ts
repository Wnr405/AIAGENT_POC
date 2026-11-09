import { z } from 'zod';

/**
 * 07-OPS-ARCH §7.3: strict env validation before anything else starts.
 * Missing or invalid variables → process exits 1 with a readable message.
 * Mirrors cms-infra/.env.example; keep both in sync (CI checks it).
 */
const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const duration = z
  .string()
  .regex(/^\d+[smhd]$/, 'use e.g. 15m, 14d')
  .transform((v) => {
    const n = Number(v.slice(0, -1));
    const unit = v.slice(-1) as 's' | 'm' | 'h' | 'd';
    return n * { s: 1, m: 60, h: 3600, d: 86400 }[unit];
  });

const csv = z.string().transform((v) =>
  v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

const baseSchema = z.object({
  NODE_ENV: z.enum(['production', 'staging', 'development', 'test']).default('development'),
  APP_NAME: z.string().default('CMS'),
  APP_VERSION: z.string().default('0.0.0-dev'),
  ROLE: z.enum(['api', 'worker']).default('api'),

  PUBLIC_URL: z.string().url(),
  API_PUBLIC_URL: z.string().url(),
  CORS_ALLOWED_ORIGINS: csv.default(''),

  HTTP_PORT: z.coerce.number().int().positive().default(3000),
  HTTP_BODY_LIMIT_MB: z.coerce.number().positive().default(25),
  TRUST_PROXY: bool.default('false'),

  /** `memory` runs without Postgres/Redis/S3 (demo + E2E); never in production. */
  PERSISTENCE: z.enum(['postgres', 'memory']).default('postgres'),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),

  OBJECT_STORAGE_PROVIDER: z.enum(['minio', 's3']).default('minio'),
  OBJECT_STORAGE_ENDPOINT: z.string().optional(),
  OBJECT_STORAGE_PRESIGN_ENDPOINT: z.string().optional(),
  OBJECT_STORAGE_REGION: z.string().default('us-east-1'),
  OBJECT_STORAGE_BUCKET: z.string().default('cms-media'),
  OBJECT_STORAGE_ACCESS_KEY: z.string().optional(),
  OBJECT_STORAGE_SECRET_KEY: z.string().optional(),
  OBJECT_STORAGE_PUBLIC_URL: z.string().optional(),

  JWT_SECRET: z.string().min(64, 'JWT_SECRET must be at least 64 characters'),
  JWT_ACCESS_TTL: duration.default('15m'),
  JWT_REFRESH_TTL: duration.default('14d'),
  ARGON2_MEMORY_KB: z.coerce.number().int().min(19456).default(19456),
  ARGON2_ITERATIONS: z.coerce.number().int().min(2).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),

  RATE_LIMIT_LOGIN_PER_MIN: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_PASSWORD_RESET_PER_HOUR: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_PUBLIC_API_PER_MIN: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_ADMIN_MUTATION_PER_MIN: z.coerce.number().int().positive().default(60),

  EMAIL_PROVIDER: z.enum(['ses', 'smtp', 'console']).default('console'),
  EMAIL_FROM: z.string().default('no-reply@example.com'),
  EMAIL_FROM_NAME: z.string().default('CMS'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: bool.default('false'),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENV: z.string().optional(),
  SENTRY_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default('cms-api'),

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  WORKER_SCHEDULED_PUBLISH_INTERVAL_SEC: z.coerce.number().int().positive().default(30),

  FEATURE_MEDIA_VARIANTS_ENABLED: bool.default('true'),
  FEATURE_SCHEDULED_PUBLISH_ENABLED: bool.default('true'),

  MEDIA_MAX_UPLOAD_MB: z.coerce.number().positive().default(20),
  CONTENT_CATEGORIES: csv.default('News,Reports,Guides,Announcements'),
  SOFT_DELETE_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
});

type RawEnv = z.infer<typeof baseSchema>;

const INFRA_KEYS = ['DATABASE_URL', 'REDIS_URL', 'OBJECT_STORAGE_ACCESS_KEY', 'OBJECT_STORAGE_SECRET_KEY'] as const;

/** Rules spanning several variables: [variable, message] for every violation. */
const CROSS_FIELD_RULES: readonly ((env: RawEnv) => [string, string][])[] = [
  (env) =>
    env.PERSISTENCE === 'postgres'
      ? INFRA_KEYS.filter((key) => !env[key]).map((key): [string, string] => [
          key,
          'required when PERSISTENCE=postgres',
        ])
      : [],
  (env) =>
    env.PERSISTENCE === 'memory' && (env.NODE_ENV === 'production' || env.NODE_ENV === 'staging')
      ? [['PERSISTENCE', 'memory persistence is not allowed in production/staging']]
      : [],
  (env) =>
    env.EMAIL_PROVIDER !== 'console' && !env.SMTP_HOST ? [['SMTP_HOST', 'required unless EMAIL_PROVIDER=console']] : [],
  (env) =>
    env.EMAIL_PROVIDER === 'console' && env.NODE_ENV === 'production'
      ? [['EMAIL_PROVIDER', 'console email is dev-only']]
      : [],
  (env) => (env.JWT_ACCESS_TTL > 3600 ? [['JWT_ACCESS_TTL', 'must be ≤ 60 minutes (FR-AUTH-04)']] : []),
  (env) => (env.JWT_REFRESH_TTL > 14 * 86400 ? [['JWT_REFRESH_TTL', 'must be ≤ 14 days (FR-AUTH-04)']] : []),
];

function crossFieldProblems(env: RawEnv): [string, string][] {
  return CROSS_FIELD_RULES.flatMap((rule) => rule(env));
}

export const envSchema = baseSchema.superRefine((env, ctx) => {
  for (const [path, message] of crossFieldProblems(env)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  }
});

export type Env = z.infer<typeof envSchema>;

/** Parses process.env; on failure prints every problem (never values) and exits. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`);
    process.stderr.write(`Invalid environment configuration:\n${lines.join('\n')}\n`);
    process.exit(1);
  }
  return result.data;
}
