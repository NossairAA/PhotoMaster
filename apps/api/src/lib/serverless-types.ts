export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type JobRecord = {
  id: string;
  uid: string;
  createdAt: string;
  expiresAt: string;
  status: JobStatus;
  progress: number;
  message: string;
  requestedFields: string[];
  fileIds: string[];
  resultObjectKey?: string;
  resultFileName?: string;
  error?: string;
  retryCount?: number;
};

export type UploadRecord = {
  id: string;
  uid: string;
  name: string;
  size: number;
  type: string;
  format: string;
  objectKey: string;
  uploadUrl: string;
  uploaded: boolean;
  uploadedAt?: string;
  expiresAt: string;
  jobId?: string;
};
