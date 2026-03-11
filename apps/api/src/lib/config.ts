import { z } from "zod";

const serverlessEnvSchema = z.object({
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  QSTASH_TOKEN: z.string().min(1),
  WORKER_URL: z.string().url(),
  WORKER_SHARED_SECRET: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
});

export type ServerlessEnv = z.infer<typeof serverlessEnvSchema>;

let cachedEnv: ServerlessEnv | null = null;

export function getServerlessEnv() {
  if (cachedEnv) return cachedEnv;
  const parsed = serverlessEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid serverless environment: ${message}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

export function nowIso() {
  return new Date().toISOString();
}

export function expiresIso(minutes = 30) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}
