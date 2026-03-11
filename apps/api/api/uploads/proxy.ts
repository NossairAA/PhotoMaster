import { verifyRequestAuth } from "../../src/auth";
import type { ApiRequest, ApiResponse } from "../_utils";
import { getBearerHeader, sendJson } from "../_utils";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const auth = await verifyRequestAuth(getBearerHeader(req.headers));
  if (!auth.ok) {
    return sendJson(res, 401, { error: auth.error });
  }

  return sendJson(res, 501, {
    error: "Proxy upload path is not implemented in serverless mode.",
    code: "NOT_IMPLEMENTED",
  });
}
