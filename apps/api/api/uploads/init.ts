import { randomUUID } from "node:crypto";
import { verifyRequestAuth } from "../../src/auth";
import { uploadInitSchema, uploadLimits } from "../../src/schemas";
import { createUploadUrl } from "../../src/lib/r2";
import { createUploadRecord } from "../../src/lib/upload-store";
import type { ApiRequest, ApiResponse } from "../_utils";
import { getBearerHeader, parseJsonBody, sendJson } from "../_utils";

function sanitizeName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

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
    const parsed = uploadInitSchema.safeParse(body);
    if (!parsed.success) {
      return sendJson(res, 400, { error: parsed.error.issues[0]?.message ?? "Invalid upload payload." });
    }

    const totalBytes = parsed.data.files.reduce((sum, file) => sum + file.size, 0);
    const maxTotalBytes = uploadLimits.maxTotalUploadMb * 1024 * 1024;
    if (totalBytes > maxTotalBytes) {
      return sendJson(res, 400, { error: `Total upload exceeds ${uploadLimits.maxTotalUploadMb} MB.` });
    }

    const preparedFiles = await Promise.all(
      parsed.data.files.map(async (file) => {
        const id = randomUUID();
        const objectKey = `uploads/${id}-${sanitizeName(file.name)}`;
        const uploadUrl = await createUploadUrl(objectKey, file.type);

        await createUploadRecord({
          id,
          uid: auth.user.uid,
          name: file.name,
          size: file.size,
          type: file.type,
          format: file.format,
          objectKey,
          uploadUrl,
        });

        return {
          id,
          name: file.name,
          size: file.size,
          type: file.type,
          format: file.format,
          objectKey,
          uploadUrl,
        };
      }),
    );

    return sendJson(res, 200, { files: preparedFiles });
  } catch (error) {
    return sendJson(res, 500, { error: error instanceof Error ? error.message : "Upload init failed." });
  }
}
