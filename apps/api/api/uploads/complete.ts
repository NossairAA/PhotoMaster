import { verifyRequestAuth } from "../../src/auth";
import { uploadCompleteSchema } from "../../src/schemas";
import { confirmObjectExists } from "../../src/lib/r2";
import { getUploadRecord, markUploadCompleted } from "../../src/lib/upload-store";
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
    const parsed = uploadCompleteSchema.safeParse(body);
    if (!parsed.success) {
      return sendJson(res, 400, { error: parsed.error.issues[0]?.message ?? "Invalid complete payload." });
    }

    const completed: string[] = [];
    for (const fileId of parsed.data.fileIds) {
      const upload = await getUploadRecord(fileId);
      if (!upload) {
        return sendJson(res, 404, { error: `Upload session not found for file: ${fileId}` });
      }

      await confirmObjectExists(upload.objectKey);
      await markUploadCompleted(fileId);
      completed.push(fileId);
    }

    return sendJson(res, 200, {
      fileIds: completed,
      message: "Uploads confirmed and ready for job creation.",
    });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : "Upload completion failed." });
  }
}
