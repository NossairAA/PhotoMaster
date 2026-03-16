import { verifyRequestAuth } from "../../../src/auth";
import { getJobRecord } from "../../../src/lib/job-store";
import type { ApiRequest, ApiResponse } from "../../_utils";
import { getBearerHeader, sendJson } from "../../_utils";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const auth = await verifyRequestAuth(getBearerHeader(req.headers));
  if (!auth.ok) {
    return sendJson(res, 401, { error: auth.error });
  }

  const id = Array.isArray(req.query?.id) ? req.query.id[0] ?? "" : req.query?.id ?? "";
  if (!id) {
    return sendJson(res, 400, { error: "Missing job id." });
  }

  const job = await getJobRecord(id);
  if (!job) {
    return sendJson(res, 404, { error: "Job not found." });
  }
  if (job.uid !== auth.user.uid) {
    return sendJson(res, 403, { error: "Job does not belong to the authenticated user." });
  }

  return sendJson(res, 501, {
    error: "Serverless download endpoint is not wired yet.",
    code: "NOT_IMPLEMENTED",
  });
}
