import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// .env lives at the repo root (architecture: 12-factor, one env file).
// Resolved from this file's location so it works from any cwd.
const ENV_PATH = fileURLToPath(new URL('../../../.env', import.meta.url));

export const configSchema = z.object({
  DATABASE_URL: z.url(),
});

export type Config = z.infer<typeof configSchema>;

let cached: Config | null = null;

// Called from the server entry point (fail fast at startup) — NOT at module
// import time, so tests can import handler modules without a .env present.
export function loadConfig(): Config {
  if (cached) return cached;
  dotenv.config({ path: ENV_PATH, quiet: true });
  const parsed = configSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(
      `Invalid environment (${ENV_PATH}): ${details}. Copy .env.example to .env and fill it in.`,
    );
  }
  cached = parsed.data;
  return cached;
}
