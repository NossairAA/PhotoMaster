import { describe, expect, it } from "vitest";
import { mergeMetadataDrafts } from "../metadata-draft";

describe("mergeMetadataDrafts", () => {
  it("uses guided values when advanced does not provide a field", () => {
    const merged = mergeMetadataDrafts(
      { cameraMake: "Apple", cameraModel: "iPhone 14 Pro" },
      { title: "Street Scene" },
    );

    expect(merged.cameraMake).toBe("Apple");
    expect(merged.cameraModel).toBe("iPhone 14 Pro");
    expect(merged.title).toBe("Street Scene");
  });

  it("lets advanced fields override guided values", () => {
    const merged = mergeMetadataDrafts(
      { cameraMake: "Apple", cameraModel: "iPhone 14 Pro" },
      { cameraModel: "iPhone 13" },
    );

    expect(merged.cameraMake).toBe("Apple");
    expect(merged.cameraModel).toBe("iPhone 13");
  });

  it("keeps explicit advanced empty values", () => {
    const merged = mergeMetadataDrafts(
      { cameraModel: "iPhone 14 Pro" },
      { cameraModel: "" },
    );

    expect(merged.cameraModel).toBe("");
  });
});
