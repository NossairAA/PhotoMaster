export function withAuthHeaders(token: string | null, headers?: HeadersInit) {
  const merged = new Headers(headers ?? {});
  const normalizedToken = token?.trim() ?? "";
  if (normalizedToken) {
    merged.set("Authorization", `Bearer ${normalizedToken}`);
  }
  return merged;
}

type UploadWithFallbackParams = {
  apiUrl: string;
  authToken: string | null;
  fileId: string;
  uploadUrl: string;
  file: File;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export async function uploadFileWithFallback(params: UploadWithFallbackParams) {
  const fetchImpl = params.fetchImpl ?? fetch;
  const timeoutMs = params.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const directResponse = await fetchImpl(params.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": params.file.type || "application/octet-stream",
      },
      body: params.file,
      signal: controller.signal,
    });

    if (directResponse.ok) {
      return { mode: "direct" as const };
    }
  } catch {
    // fall back to proxy path below
  } finally {
    clearTimeout(timeout);
  }

  const formData = new FormData();
  formData.set("fileId", params.fileId);
  formData.set("file", params.file, params.file.name);

  const proxyResponse = await fetchImpl(`${params.apiUrl}/api/uploads/proxy`, {
    method: "POST",
    headers: withAuthHeaders(params.authToken),
    body: formData,
  });

  if (!proxyResponse.ok) {
    throw new Error(`Upload failed (${proxyResponse.status})`);
  }

  return { mode: "proxy" as const };
}
