import { verifyRequestAuth } from "../../src/auth";
import { deleteJobRecord, getJobRecord } from "../../src/lib/job-store";
import { redisKeys } from "../../src/lib/upstash";
import { deleteUploadRecord, getUploadRecord } from "../../src/lib/upload-store";
import type { ApiRequest, ApiResponse } from "../_utils";
import { getBearerHeader, sendJson } from "../_utils";

function getRouteId(req: ApiRequest) {
  const value = req.query?.id;
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

async function deleteUploadsForJob(jobId: string) {
  const uploadKeys = await redisKeys("upload:*");
  if (!uploadKeys.length) return;

  for (const uploadKey of uploadKeys) {
    const [, uploadId = ""] = uploadKey.split("upload:");
    if (!uploadId) continue;
    const upload = await getUploadRecord(uploadId);
    if (upload?.jobId === jobId) {
      await deleteUploadRecord(uploadId);
    }
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const auth = await verifyRequestAuth(getBearerHeader(req.headers));
  if (!auth.ok) {
    return sendJson(res, 401, { error: auth.error });
  }

  const id = getRouteId(req);
  if (!id) {
    return sendJson(res, 400, { error: "Missing job id." });
  }

  if (req.method === "GET") {
    const job = await getJobRecord(id);
    if (!job) {
      return sendJson(res, 404, { error: "Job not found." });
    }

    return sendJson(res, 200, {
      id: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      createdAt: job.createdAt,
      expiresAt: job.expiresAt,
      error: job.error,
    });
  }

  if (req.method === "DELETE") {
    await deleteJobRecord(id);
    await deleteUploadsForJob(id);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 405, { error: "Method not allowed" });
}
