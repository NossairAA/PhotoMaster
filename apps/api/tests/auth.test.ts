import { describe, expect, it } from "vitest";
import { extractBearerToken, resolveServiceAccountPath, verifyRequestAuth } from "../src/auth.js";

describe("auth helpers", () => {
  const normalizePath = (value: string) => value.replace(/\\/g, "/");

  it("extracts bearer token correctly", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
    expect(extractBearerToken("bearer xyz")).toBe("xyz");
  });

  it("returns null for invalid auth header", () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken("Token abc")).toBeNull();
    expect(extractBearerToken("Bearer")).toBeNull();
  });

  it("accepts bypass auth token when configured", async () => {
    process.env.AUTH_TEST_BYPASS_TOKEN = "test-token";
    const result = await verifyRequestAuth("Bearer test-token");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.uid).toBe("test-user");
    }
    delete process.env.AUTH_TEST_BYPASS_TOKEN;
  });

  it("resolves service account path from repository root", () => {
    const resolved = resolveServiceAccountPath("serviceAccountKey.json", "/repo", (candidate) => {
      return normalizePath(candidate) === "/repo/apps/api/serviceAccountKey.json";
    });

    expect(normalizePath(resolved)).toBe("/repo/apps/api/serviceAccountKey.json");
  });

  it("resolves service account path from api cwd", () => {
    const resolved = resolveServiceAccountPath("apps/api/serviceAccountKey.json", "/repo/apps/api", (candidate) => {
      return normalizePath(candidate) === "/repo/apps/api/serviceAccountKey.json";
    });

    expect(normalizePath(resolved)).toBe("/repo/apps/api/serviceAccountKey.json");
  });
});
