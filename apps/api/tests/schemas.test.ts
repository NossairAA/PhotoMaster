import { describe, expect, it } from "vitest";
import {
  createJobSchema,
  metadataOverrideSchema,
  uploadCompleteSchema,
  uploadInitSchema,
} from "../src/schemas.js";

describe("schemas", () => {
  it("accepts valid upload init payload", () => {
    const parsed = uploadInitSchema.safeParse({
      files: [
        {
          name: "sample.jpg",
          size: 1024,
          type: "image/jpeg",
          format: "jpg",
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid upload complete payload", () => {
    const parsed = uploadCompleteSchema.safeParse({
      fileIds: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("validates metadata override gps bounds", () => {
    const parsed = metadataOverrideSchema.safeParse({
      gpsLatitude: 120,
      gpsLongitude: 20,
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts create job with file ids", () => {
    const parsed = createJobSchema.safeParse({
      fileIds: ["file-1"],
      overrides: {
        title: "Test",
        dateTimeOriginal: "2026:02:08 16:19:58",
      },
    });

    expect(parsed.success).toBe(true);
  });
});
