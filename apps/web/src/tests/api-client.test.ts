import { describe, expect, it } from "vitest";
import { uploadFileWithFallback, withAuthHeaders } from "../api-client";

describe("withAuthHeaders", () => {
  it("adds bearer token when present", () => {
    const headers = withAuthHeaders("token-123", { "Content-Type": "application/json" });
    expect(headers.get("Authorization")).toBe("Bearer token-123");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("does not add auth header when token missing", () => {
    const headers = withAuthHeaders(null);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("trims token before setting auth header", () => {
    const headers = withAuthHeaders("  token-123  ");
    expect(headers.get("Authorization")).toBe("Bearer token-123");
  });
});

describe("uploadFileWithFallback", () => {
  it("uses direct signed upload when it succeeds", async () => {
    const mockFetch = async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe("PUT");
      return new Response(null, { status: 200 });
    };

    const result = await uploadFileWithFallback({
      apiUrl: "http://localhost:4000",
      authToken: "token-abc",
      fileId: "file-1",
      uploadUrl: "https://signed.example.com",
      file: new File(["hello"], "a.jpg", { type: "image/jpeg" }),
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(result.mode).toBe("direct");
  });

  it("falls back to proxy upload when direct upload fails", async () => {
    let callCount = 0;
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    const mockFetch = async (url: string, init?: RequestInit) => {
      callCount += 1;
      calls.push({ url, init });

      if (callCount === 1) {
        throw new Error("network blocked");
      }

      return new Response(null, { status: 200 });
    };

    const result = await uploadFileWithFallback({
      apiUrl: "http://localhost:4000",
      authToken: "token-abc",
      fileId: "file-2",
      uploadUrl: "https://signed.example.com",
      file: new File(["hello"], "b.jpg", { type: "image/jpeg" }),
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    expect(result.mode).toBe("proxy");
    expect(calls[1]?.url).toBe("http://localhost:4000/api/uploads/proxy");
    const proxyHeaders = new Headers(calls[1]?.init?.headers);
    expect(proxyHeaders.get("Authorization")).toBe("Bearer token-abc");
  });
});
