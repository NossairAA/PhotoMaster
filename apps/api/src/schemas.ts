import { z } from "zod";

export const supportedFormats = ["jpg", "jpeg", "png", "heic", "heif"] as const;
export const uploadLimits = {
  maxFilesPerJob: 24,
  maxFileSizeMb: 12,
  maxTotalUploadMb: 180,
} as const;

const formatSchema = z.enum(supportedFormats);

export const uploadInitSchema = z.object({
  files: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        size: z.number().int().positive(),
        type: z.string().trim().min(1),
        format: formatSchema,
      }),
    )
    .min(1)
    .max(uploadLimits.maxFilesPerJob),
});

export type UploadInitInput = z.infer<typeof uploadInitSchema>;

export const uploadCompleteSchema = z.object({
  fileIds: z.array(z.string().trim().min(1)).min(1).max(uploadLimits.maxFilesPerJob),
});

export type UploadCompleteInput = z.infer<typeof uploadCompleteSchema>;

export const uploadResponseFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().int().positive(),
  type: z.string(),
  format: formatSchema,
});

export const metadataOverrideSchema = z.object({
  dateTimeOriginal: z.string().trim().min(1).optional(),
  gpsLatitude: z.number().min(-90).max(90).optional(),
  gpsLongitude: z.number().min(-180).max(180).optional(),
  locationLabel: z.string().trim().min(1).max(200).optional(),
  cameraMake: z.string().trim().min(1).max(128).optional(),
  cameraModel: z.string().trim().min(1).max(128).optional(),
  lensModel: z.string().trim().min(1).max(128).optional(),
  iso: z.number().int().positive().max(1000000).optional(),
  focalLengthMm: z.number().positive().max(5000).optional(),
  exposureCompensationEv: z.number().min(-20).max(20).optional(),
  apertureFNumber: z.number().positive().max(64).optional(),
  shutterSpeed: z.string().trim().min(1).max(64).optional(),
  imageWidth: z.number().int().positive().max(20000).optional(),
  imageHeight: z.number().int().positive().max(20000).optional(),
  megapixels: z.number().positive().max(300).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  caption: z.string().trim().min(1).max(2000).optional(),
  keywords: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
  author: z.string().trim().min(1).max(120).optional(),
  copyright: z.string().trim().min(1).max(120).optional(),
});

export const createJobSchema = z.object({
  fileIds: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(uploadLimits.maxFilesPerJob),
  presetPhoneId: z.string().trim().min(1).max(120).optional(),
  presetCameraId: z.string().trim().min(1).max(120).optional(),
  presetLabel: z.string().trim().min(1).max(240).optional(),
  overrides: metadataOverrideSchema,
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const fieldCompatibility = {
  jpg: ["full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full"],
  jpeg: ["full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full", "full"],
  png: ["partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "full", "full", "full", "full"],
  heic: ["partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "full", "full", "full", "full"],
  heif: ["partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "partial", "full", "full", "full", "full"],
} as const;

export const fields = [
  "dateTimeOriginal",
  "gpsLatitude",
  "gpsLongitude",
  "locationLabel",
  "cameraMake",
  "cameraModel",
  "lensModel",
  "iso",
  "focalLengthMm",
  "exposureCompensationEv",
  "apertureFNumber",
  "shutterSpeed",
  "imageWidth",
  "imageHeight",
  "megapixels",
  "title",
  "caption",
  "keywords",
  "author",
  "copyright",
] as const;
