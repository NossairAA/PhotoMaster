import { randomUUID } from "node:crypto";
import { verifyRequestAuth } from "../../src/auth";
import { createJobSchema } from "../../src/schemas";
import { createJobRecord } from "../../src/lib/job-store";
import { enqueueJob } from "../../src/lib/queue";
import { attachUploadToJob, getUploadRecord } from "../../src/lib/upload-store";
import type { ApiRequest, ApiResponse } from "../_utils";
import { getBearerHeader, parseJsonBody, sendJson } from "../_utils";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const auth = await verifyRequestAuth(getBearerHeader(req.headers));
  if (!auth.ok) {
    return sendJson(res, 401, { error: auth.error });
  }

  try {
    const body = parseJsonBody<unknown>(req.body);
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return sendJson(res, 400, { error: parsed.error.issues[0]?.message ?? "Invalid job payload." });
    }

    const uploaded = await Promise.all(parsed.data.fileIds.map((fileId) => getUploadRecord(fileId)));
    if (uploaded.some((file) => !file)) {
      return sendJson(res, 400, { error: "One or more files are not initialized." });
    }
    if (uploaded.some((file) => !file?.uploaded)) {
      return sendJson(res, 409, { error: "All files must be uploaded and confirmed before job creation." });
    }

    const jobId = randomUUID();
    const requestedFields = Object.keys(parsed.data.overrides);

    await createJobRecord({
      id: jobId,
      requestedFields,
      fileIds: parsed.data.fileIds,
      message: "Job queued. Processing will start shortly.",
    });

    await Promise.all(parsed.data.fileIds.map((fileId) => attachUploadToJob(fileId, jobId)));
    await enqueueJob({ jobId });

    return sendJson(res, 200, {
      id: jobId,
      status: "queued",
      progress: 5,
      message: "Job queued. Processing started...",
    });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : "Job creation failed." });
  }
}
