import { describe, expect, it } from "vitest";
import { buildJobOverrides } from "../job-overrides";
import { createEmptyMetadataDraft } from "../metadata-draft";

describe("buildJobOverrides", () => {
  it("returns trimmed text and keyword fields", () => {
    const result = buildJobOverrides({
      ...createEmptyMetadataDraft(),
      cameraMake: "  Canon ",
      locationLabel: "  Tokyo ",
      keywordsText: "street, night,  neon ",
    });

    expect(result.error).toBeNull();
    expect(result.overrides).toEqual({
      cameraMake: "Canon",
      locationLabel: "Tokyo",
      keywords: ["street", "night", "neon"],
    });
  });

  it("parses valid coordinates as numbers", () => {
    const result = buildJobOverrides({
      ...createEmptyMetadataDraft(),
      gpsLatitude: "35.6762",
      gpsLongitude: "139.6503",
    });

    expect(result.error).toBeNull();
    expect(result.overrides).toEqual({
      gpsLatitude: 35.6762,
      gpsLongitude: 139.6503,
    });
  });

  it("returns an error for invalid latitude", () => {
    const result = buildJobOverrides({
      ...createEmptyMetadataDraft(),
      gpsLatitude: "north",
    });

    expect(result.error).toBe("Latitude must be a valid number.");
    expect(result.overrides).toEqual({});
  });

  it("returns an error for out-of-range longitude", () => {
    const result = buildJobOverrides({
      ...createEmptyMetadataDraft(),
      gpsLongitude: "181",
    });

    expect(result.error).toBe("Longitude must be less than or equal to 180.");
    expect(result.overrides).toEqual({});
  });
});
