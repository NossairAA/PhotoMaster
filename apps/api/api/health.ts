import type { ApiRequest, ApiResponse } from "./_utils";
import { sendJson } from "./_utils";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  return sendJson(res, 200, {
    status: "ok",
    runtime: "vercel",
    timestamp: new Date().toISOString(),
  });
}
