import { expiresIso } from "./config.js";
import type { JobRecord, JobStatus } from "./serverless-types.js";
import { redisDelete, redisGetJson, redisSetJson } from "./upstash.js";

const JOB_PREFIX = "job:";
const DEFAULT_JOB_TTL_SECONDS = 60 * 60;

function key(id: string) {
  return `${JOB_PREFIX}${id}`;
}

export async function createJobRecord(input: {
  id: string;
  requestedFields: string[];
  fileIds: string[];
  message?: string;
}) {
  const record: JobRecord = {
    id: input.id,
    createdAt: new Date().toISOString(),
    expiresAt: expiresIso(30),
    status: "queued",
    progress: 5,
    message: input.message ?? "Job queued for processing.",
    requestedFields: input.requestedFields,
    fileIds: input.fileIds,
    retryCount: 0,
  };

  await redisSetJson(key(input.id), record, DEFAULT_JOB_TTL_SECONDS);
  return record;
}

export async function getJobRecord(id: string) {
  return redisGetJson<JobRecord>(key(id));
}

export async function updateJobRecord(id: string, patch: Partial<JobRecord>) {
  const existing = await getJobRecord(id);
  if (!existing) return null;
  const updated: JobRecord = { ...existing, ...patch };
  await redisSetJson(key(id), updated, DEFAULT_JOB_TTL_SECONDS);
  return updated;
}

export async function updateJobState(id: string, status: JobStatus, message: string, progress: number) {
  return updateJobRecord(id, {
    status,
    message,
    progress,
  });
}

export async function deleteJobRecord(id: string) {
  await redisDelete(key(id));
}
