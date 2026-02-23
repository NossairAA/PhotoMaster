import { describe, expect, it } from "vitest";
import { buildDateOverride, formatDateTimeLocalToExif, formatExifDateTime } from "../date-overrides";

describe("date overrides", () => {
  it("formats date to exif format", () => {
    const output = formatExifDateTime(new Date("2026-02-08T16:19:58"));
    expect(output).toBe("2026:02:08 16:19:58");
  });

  it("converts datetime-local value", () => {
    expect(formatDateTimeLocalToExif("2026-02-08T16:19")).toBe("2026:02:08 16:19:00");
  });

  it("returns now value when mode is now", () => {
    const result = buildDateOverride("now", "", new Date("2026-02-08T16:19:58"));
    expect(result.error).toBeNull();
    expect(result.value).toBe("2026:02:08 16:19:58");
  });

  it("returns error when custom mode has no date", () => {
    const result = buildDateOverride("custom", "");
    expect(result.error).toBe("Pick a custom date before processing.");
  });
});
