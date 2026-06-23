import { z } from 'zod';

export const envSchema = z.object({
  // Environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Application
  DEV_APP_PORT: z.coerce.number().positive().default(3000),
  DEV_APP_HOST: z.string().min(1).default('localhost'),

  // Database
  DB_USERNAME: z.string().default('postgres'),
  DB_PASSWORD: z.string().min(8),
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().positive().default(5432),
  DB_NAME: z.string().default('leoxora_db'),

  // Redis
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().positive().default(6379),
  REDIS_PASSWORD: z.string().min(8),

  // JWT
  JWT_SECRET: z.string().min(32),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export function validateEnv(env: Record<string, unknown>) {
  return envSchema.parse(env);
}

export type EnvConfig = z.infer<typeof envSchema>;
