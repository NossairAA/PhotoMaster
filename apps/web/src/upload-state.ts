export type UploadStatus = "idle" | "uploading" | "uploaded" | "failed";

export function canCreateJob(params: {
  selectedFileCount: number;
  uploadedFileCount: number;
  uploadStatus: UploadStatus;
  isSubmitting: boolean;
}) {
  return (
    params.selectedFileCount > 0 &&
    params.uploadedFileCount === params.selectedFileCount &&
    params.uploadStatus === "uploaded" &&
    !params.isSubmitting
  );
}
