import { verifyRequestAuth } from "../../../src/auth";
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

  return sendJson(res, 501, {
    error: "Serverless download endpoint is not wired yet.",
    code: "NOT_IMPLEMENTED",
  });
}
