import { describe, expect, it } from "vitest";
import { canCreateJob } from "../upload-state";

describe("canCreateJob", () => {
  it("returns false when no files are selected", () => {
    expect(
      canCreateJob({
        selectedFileCount: 0,
        uploadedFileCount: 0,
        uploadStatus: "uploaded",
        isSubmitting: false,
      }),
    ).toBe(false);
  });

  it("returns false while upload is in progress", () => {
    expect(
      canCreateJob({
        selectedFileCount: 1,
        uploadedFileCount: 0,
        uploadStatus: "uploading",
        isSubmitting: false,
      }),
    ).toBe(false);
  });

  it("returns false when uploaded file count does not match selection", () => {
    expect(
      canCreateJob({
        selectedFileCount: 2,
        uploadedFileCount: 1,
        uploadStatus: "uploaded",
        isSubmitting: false,
      }),
    ).toBe(false);
  });

  it("returns true only when files are uploaded and not submitting", () => {
    expect(
      canCreateJob({
        selectedFileCount: 1,
        uploadedFileCount: 1,
        uploadStatus: "uploaded",
        isSubmitting: false,
      }),
    ).toBe(true);
  });
});
