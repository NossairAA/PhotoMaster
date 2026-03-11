import { expiresIso } from "./config.js";
import type { UploadRecord } from "./serverless-types.js";
import { redisDelete, redisGetJson, redisSetJson } from "./upstash.js";

const UPLOAD_PREFIX = "upload:";
const DEFAULT_UPLOAD_TTL_SECONDS = 30 * 60;

function key(id: string) {
  return `${UPLOAD_PREFIX}${id}`;
}

export async function createUploadRecord(input: Omit<UploadRecord, "expiresAt" | "uploaded" | "uploadedAt">) {
  const record: UploadRecord = {
    ...input,
    uploaded: false,
    expiresAt: expiresIso(20),
  };
  await redisSetJson(key(record.id), record, DEFAULT_UPLOAD_TTL_SECONDS);
  return record;
}

export async function getUploadRecord(id: string) {
  return redisGetJson<UploadRecord>(key(id));
}

export async function markUploadCompleted(id: string) {
  const existing = await getUploadRecord(id);
  if (!existing) return null;

  const updated: UploadRecord = {
    ...existing,
    uploaded: true,
    uploadedAt: new Date().toISOString(),
  };
  await redisSetJson(key(id), updated, DEFAULT_UPLOAD_TTL_SECONDS);
  return updated;
}

export async function attachUploadToJob(id: string, jobId: string) {
  const existing = await getUploadRecord(id);
  if (!existing) return null;

  const updated: UploadRecord = {
    ...existing,
    jobId,
  };
  await redisSetJson(key(id), updated, DEFAULT_UPLOAD_TTL_SECONDS);
  return updated;
}

export async function deleteUploadRecord(id: string) {
  await redisDelete(key(id));
}
