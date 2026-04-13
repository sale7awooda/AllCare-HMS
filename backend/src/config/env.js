const { z } = require('zod');

/**
 * Validates and parses required environment variables at startup.
 * In production, missing variables cause process.exit(1).
 * In development, missing variables fallback to safe defaults.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).optional().default('3001'),
  // In production, JWT_SECRET is enforced by auth.js already — but we validate it here too
  JWT_SECRET: z.string().min(32).optional(),
  DB_PATH: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
});

const validateEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.errors.map(e => `  ${e.path.join('.')}: ${e.message}`).join('\n');

    if (process.env.NODE_ENV === 'production') {
      console.error('[Env] FATAL: Invalid or missing environment variables:\n' + issues);
      process.exit(1);
    } else {
      console.warn('[Env] WARNING: Environment variable issues (safe for development):\n' + issues);
    }
    return;
  }

  // Extra guard: warn if JWT_SECRET is not set in any mode
  if (!result.data.JWT_SECRET) {
    console.warn('[Env] WARNING: JWT_SECRET is not set. Tokens will not persist across restarts.');
  }

  console.log('[Env] Environment validated OK.');
};

module.exports = { validateEnv };
